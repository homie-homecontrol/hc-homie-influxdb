import { Core } from './core/Core';
import * as winston from "winston";
import { InfluxDBLoggerController } from './controller/Controller';
import { OnDestroy, OnInit } from 'node-homie/misc';

export function chunk<T>(array: T[], chunkSize: number) {
  array.splice(0, chunkSize);
}




export class App implements OnInit, OnDestroy {
  protected readonly log: winston.Logger;

  private core: Core;
  private controller: InfluxDBLoggerController

  constructor() {
    this.log = winston.child({
      name: 'App',
      type: this.constructor.name,
    });


    this.core = new Core();

    const mqttOpts = {
      url: this.core.settings.mqtt_url,
      username: this.core.settings.mqtt_user,
      password: this.core.settings.mqtt_password,
      topicRoot: this.core.settings.mqtt_topic_root
    };

    this.controller = new InfluxDBLoggerController(this.core, this.core.settings.controller_id, this.core.settings.controller_name, mqttOpts);
  }

  public async onInit() {
    try {
      this.log.info('Bootstrapping core ...');
      await this.core.bootstrap();
      this.log.info('... done! [Bootstrapping core]');

      await this.controller.onInit();

      const mqttOpts = {
        url: this.core.settings.mqtt_url,
        username: this.core.settings.mqtt_user,
        password: this.core.settings.mqtt_password,
        topicRoot: this.core.settings.mqtt_topic_root
      };


    } catch (error) {
      this.log.error('Error starting service!', error);
      process.exit(1);
    }
  }

  async onDestroy() {
    try {
      await this.controller.onDestroy();
      await this.core.shutdown();
    } catch (err) {
      this.log.error('Error stopping application: ', err);
    }
  }

}

export default App;
