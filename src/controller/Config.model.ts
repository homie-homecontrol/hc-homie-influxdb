import { Query } from "node-homie/model";
import { PropertySelector } from "node-homie/model";

export type PersistenceConfigs = PersistenceConfig[];

export type PropertySel = PropertySelector | Query;

export interface PersistenceConfig {
    /** ID of persistence config */
    id: string;
    /** cron expressions for scheduled persistence e.g. every hour */
    persistSchedules?: string[];
    /** Persist whenever a value is received */
    persistOnValueUpdate?: boolean;
    /** Persist only when the value changed */
    onlyOnChanged?: boolean;
    /** List of properties that should be persisted */
    properties: PropertySel[];
}