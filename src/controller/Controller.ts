import { distinctUntilChanged, filter, map, mergeMap, skip, switchMap, take, takeUntil } from "rxjs";
import { merge, Observable, of, Subject } from 'rxjs';
import { Core } from "../core/Core";
import { join } from "path";
import { AddDiscoveryEvent, DeviceDiscovery, HomieDevice, HomieProperty, RemoveDiscoveryEvent } from "node-homie";
import { MQTTConnectOpts } from "node-homie/model";
import { ConfigContentWatcher, ConfigFileWatcher, ConfigMapWatcher } from "cfg-watcher";
import { hm2Type } from "node-homie/util";
import { InfluxDB, Point, WriteApi, setLogger } from '@influxdata/influxdb-client'
import { PersistenceConfig } from "./Config.model";
import { schedule } from "node-cron";
import { HomieDatatype, isPropertySelector, PropertyPointer } from "node-homie/model";
import { HomieControllerBase } from 'node-homie/controller';

const configSchema = require.main.require('./HcHomieInfluxDb.Config.Schema.json');


export interface ValueUpdate {
    pointer: PropertyPointer;
    datatype: HomieDatatype;
    value: string;
    timestamp?: Date;
}

export function cron(expr: string): Observable<number> {
    let counter = 0

    return new Observable<number>((subscriber) => {
        const task = schedule(expr, () => {
            subscriber.next(counter++)
        })

        task.start()

        return () => task.destroy()
    })
}



export class InfluxDBLoggerController extends HomieControllerBase {
    protected discovery: DeviceDiscovery;

    private ccW: ConfigContentWatcher<PersistenceConfig>;

    private influxDB: InfluxDB;
    private influxWriteAPI: WriteApi;


    private _unsubWatcher$ = new Subject<string>();
    private unsubWatcher$ = this._unsubWatcher$.asObservable();


    constructor(protected core: Core, id: string, name: string, mqttOpts: MQTTConnectOpts) {
        super(id, name, mqttOpts);
        this.discovery = new DeviceDiscovery(this.mqttOpts);

        setLogger({
            error: (message, err) => {
                this.log.error(message, { error: err });
            },
            warn: (message, err) => {
                this.log.warn(message, { error: err });
            }
        })

        this.influxDB = new InfluxDB({ url: this.core.settings.influxdb_url, token: this.core.settings.influxdb_token });
        this.influxWriteAPI = this.influxDB.getWriteApi(this.core.settings.influxdb_org, this.core.settings.influxdb_bucket);
    }

    async onInit(): Promise<void> {
        await super.onInit();


        this.discovery.events$.pipe(takeUntil(this.onDestroy$),
            filter(msg => msg.type === 'add'),
            map(msg => <AddDiscoveryEvent>msg)
        ).subscribe({
            next: msg => {
                if (!this.core.deviceManager.hasDevice(msg.deviceId)) {
                    const device = this.core.deviceManager.add(msg.makeDevice())
                    this.log.debug('New Device: ', { id: device.pointer });
                    device.onInit();
                }
            }
        })

        this.discovery.events$.pipe(takeUntil(this.onDestroy$),
            filter(msg => msg.type === 'remove'),
            map(msg => <RemoveDiscoveryEvent>msg)
        ).subscribe({
            next: async msg => {
                if (this.core.deviceManager.hasDevice(msg.deviceId)) {

                    const device = this.core.deviceManager.getDevice(msg.deviceId);
                    // this.log.info(`Remove Device ${device.id}`);
                    this.core.deviceManager.removeDevice(msg.deviceId)
                    this.log.debug(`Remove Device ${device.id}`);
                    await device.onDestroy();
                }
            }
        })

        this.discovery.onInit();

        const configWatch = (this.core.settings.config_backend === 'file' ?
            new ConfigFileWatcher(['*.yaml', '*.yml'].map(fileFilter => join(this.core.settings.config_folder, fileFilter))) :
            new ConfigMapWatcher(this.core.settings.config_kubernetes_configmap));

        this.ccW = new ConfigContentWatcher(configWatch, configSchema, cfg => cfg.id);

        this.ccW.changes$.pipe(
            takeUntil(this.onDestroy$),
        ).subscribe({
            next: change => {
                if (change.name === 'remove') {
                    this._unsubWatcher$.next(change.id);
                } else if (change.name === 'add') {
                    this.makeWatcher(change.item.obj);
                } else if (change.name === 'update') {
                    this._unsubWatcher$.next(change.id);
                    this.makeWatcher(change.item.obj);
                }
            },
            error: err => {
                this.log.error('Error watching for config changes: ', { error: err });
            }

        })
        await this.ccW.onInit();

        await this.controllerDevice.onInit();
    }

    private makeWatcher(persistenceConfig: PersistenceConfig) {
        const valueUpdates$ = merge(
            ...persistenceConfig.properties.map( // map all propertyPointers
                selector => {
                    if (isPropertySelector(selector)) {
                        return this.core.deviceManager.selectProperty(selector, 200, false).pipe(    // to properties
                            switchMap(property => this.propertyToValueUpdateStream(persistenceConfig, property))

                        );
                    } else {
                        return this.core.deviceManager.query(selector).pipe(
                            switchMap(properties => merge(...properties.map(property => this.propertyToValueUpdateStream(persistenceConfig, property))))
                        )
                    }
                })
        )

        const schedules$ = !persistenceConfig.persistSchedules ? of(<ValueUpdate>null) : merge(
            ...persistenceConfig.persistSchedules?.map(schedule => cron(schedule))).pipe( // merge all schedule cron observables
                switchMap(_ => { // when a cron emits, switch subscription to stream of valueUpdates
                    const timestamp = new Date(); // create a timestamp to use for all updates to keep consistency
                    return merge(
                        ...persistenceConfig.properties // merge all properties entries depending on their type to
                            .map(selector =>
                                isPropertySelector(selector) ? // if properties entry is a property selector...
                                    this.core.deviceManager.selectProperty(selector, 200, false).pipe(take(1), // directly select the property 
                                        map(property => this.propertyToValueUpdate(property, timestamp))  // map the property to a valueUpdate
                                    )
                                    : // else if the properties entry is a query 
                                    this.core.deviceManager.query(selector).pipe(mergeMap(properties => properties), // query devices and merge result array down to single properties
                                        map(property => this.propertyToValueUpdate(property, timestamp))// map each property to a valueUpdate
                                    )
                            ));
                })
            )

        this.log.info(`Created watcher for ${persistenceConfig.id}`);

        merge(valueUpdates$, schedules$).pipe(
            takeUntil(
                merge(
                    this.onDestroy$, // complete on controller destruction ... or ...
                    this.unsubWatcher$.pipe(filter(id => id === persistenceConfig.id)) // complete when config id is requested for unsubscription
                )
            ),
            filter(value => !!value),
            filter(valueUpdate => !!valueUpdate.value && !!valueUpdate.datatype),
        ).subscribe({
            next: valueUpdate => {
                const point = new Point(valueUpdate.pointer);

                if (valueUpdate.datatype === "integer") {
                    point.intField('value', hm2Type(valueUpdate.value, valueUpdate.datatype));
                } else if (valueUpdate.datatype === "float") {
                    point.floatField('value', hm2Type(valueUpdate.value, valueUpdate.datatype));
                } else if (valueUpdate.datatype === "string" || valueUpdate.datatype === "enum") {
                    point.stringField('value', hm2Type(valueUpdate.value, valueUpdate.datatype));
                } else if (valueUpdate.datatype === "boolean") {
                    point.booleanField('value', hm2Type(valueUpdate.value, valueUpdate.datatype));
                } else {
                    point.stringField('value', valueUpdate.value);
                }

                if (valueUpdate.timestamp) {
                    point.timestamp(valueUpdate.timestamp);
                }

                try {
                    this.log.info(`${persistenceConfig.id} - ${valueUpdate.pointer} -- ${valueUpdate.value}`);
                    this.influxWriteAPI.writePoint(point)
                } catch (err) {
                    this.log.error(`Error updating measurment for ${persistenceConfig.id} - ${valueUpdate.pointer} -- ${valueUpdate.value}:`, { err });
                }
            },
            complete: () => {
                this.log.info(`Unsubscribed for config id: ${persistenceConfig.id}`)
            }
        })
    }

    private propertyToValueUpdateStream(persistenceConfig: PersistenceConfig, property: HomieProperty): Observable<ValueUpdate> {
        let value$ = property.value$.pipe(skip(1));
        if (persistenceConfig.onlyOnChanged) {
            value$ = property.value$.pipe(distinctUntilChanged()); // only allow distinct values
        }
        return value$.pipe(
            map(value => this.propertyToValueUpdate(property, undefined, value))
        )
    }

    private propertyToValueUpdate(property: HomieProperty, timestamp?: Date, value?: string): ValueUpdate {
        return { pointer: property.pointer, datatype: property.attributes.datatype, value: value ? value : property.value, timestamp: timestamp }
    }




    async onDestroy(): Promise<void> {
        super.onDestroy();
        await this.controllerDevice.onDestroy();
        await this.ccW.onDestroy();
        await this.discovery.onDestroy();

    }


}

