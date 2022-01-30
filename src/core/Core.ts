
import { Settings } from './Settings';
import { Subject } from 'rxjs';
import { HomieDeviceManager } from 'node-homie';




export class Core {


    settings: Settings;

    onShutdown$ = new Subject<boolean>();

    deviceManager: HomieDeviceManager = new HomieDeviceManager();

    
    constructor() {
        this.settings = new Settings();
    }

    public async bootstrap() {
      
    }

    public async shutdown() {
        this.onShutdown$.next(true);
    }

}
