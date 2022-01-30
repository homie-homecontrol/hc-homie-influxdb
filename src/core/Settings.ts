import { HomieID, isHomieID, MQTTConnectOpts } from 'node-homie/model';
import { Globals } from '../globals';

function getEnvVar(name: string): string | undefined {
    return process.env[`${Globals.SERVICE_NAMESPACE}_${name}`];
}

function stringENVVal(name: string, defval: string): string {
    return getEnvVar(name) || defval;
}

function homieIDENVVal(name: string, defval: HomieID): string {
    const val = getEnvVar(name) || defval;
    if (!isHomieID(val)) {
        throw new Error(`[${val}] is not a valid homie-id`);
    }
    return val;
}

function csvENVVal(name: string, defval: string[]): string[] {
    if (getEnvVar(name)) {
        return process.env[name]!.split(',');
    }
    return defval;
}

function boolENVVal(name: string, defval: boolean): boolean {
    const val = getEnvVar(name);
    if (!val) { return defval; }

    if (val.toLowerCase() === 'true' || val === '1') {
        return true;
    } else if (val.toLowerCase() === 'false' || val === '0') {
        return false;
    } else {
        return defval;
    }

}

function numberENVVal(name: string, defval: number): number {
    const val = getEnvVar(name) || defval;
    const _number: number = (typeof val === 'string') ? parseInt(val, 10) : val;
    return isNaN(_number) ? defval : _number;
}


export class Settings {

    mqttOpts: MQTTConnectOpts;

    constructor(

            public controller_id = homieIDENVVal(`CTRL_ID`, 'influx-ctrl-1'),
            public controller_name = stringENVVal(`CTRL_NAME`, 'homie to influxdb controller'),

            public influxdb_url             = stringENVVal(`INFLUXDB_URL`, ''),
            public influxdb_token           = stringENVVal(`INFLUXDB_TOKEN`, ''), 
            public influxdb_org             = stringENVVal(`INFLUXDB_ORG`, ''),
            public influxdb_bucket          = stringENVVal(`INFLUXDB_BUCKET`, ''), 


            public config_backend               = stringENVVal(`CONFIG_BACKEND`, 'file'), 
            public config_folder                = stringENVVal(`CONFIG_FOLDER`, 'config'), 
            public config_kubernetes_configmap  = stringENVVal(`CONFIG_KUBERNETES_CONFIGMAP`, 'hc-homie-influxdb-config'), 

            public mqtt_url                 =  stringENVVal(`MQTT_URL`, ''),
            public mqtt_user                =  stringENVVal(`MQTT_USERNAME`, ''),
            public mqtt_password            =  stringENVVal(`MQTT_PASSWORD`, ''),
            public mqtt_topic_root          =  stringENVVal(`MQTT_TOPIC_ROOT`, 'homie')


    ) {
        this.mqttOpts = {
            url: this.mqtt_url,
            username: this.mqtt_user,
            password: this.mqtt_password,
            topicRoot: this.mqtt_topic_root
        }
    }

}
