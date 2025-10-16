import { DateTime } from 'luxon';
export declare let containerStartTime: DateTime | null;
export declare let metadataFetched: boolean;
export declare function fetchECSMetadata(): Promise<void>;
export declare function getFormattedStartupTime(): string | null;
export declare function getRelativeStartupTime(): string | null;
