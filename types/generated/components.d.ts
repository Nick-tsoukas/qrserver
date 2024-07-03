import type { Schema, Attribute } from '@strapi/strapi';

export interface ScanTimeScanTime extends Schema.Component {
  collectionName: 'components_scan_time_scan_times';
  info: {
    displayName: 'scanTime';
  };
  attributes: {
    date: Attribute.String;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'scan-time.scan-time': ScanTimeScanTime;
    }
  }
}
