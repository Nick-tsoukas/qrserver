import type { Schema, Attribute } from '@strapi/strapi';

export interface AlbumSong extends Schema.Component {
  collectionName: 'components_album_songs';
  info: {
    name: 'song';
    icon: 'music';
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    file: Attribute.Media<'audios'> & Attribute.Required;
  };
}

export interface MemberMembers extends Schema.Component {
  collectionName: 'components_member_members';
  info: {
    displayName: 'members';
  };
  attributes: {
    name: Attribute.String;
    instrument: Attribute.String;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
  };
}

export interface ScanTimeScanTime extends Schema.Component {
  collectionName: 'components_scan_time_scan_times';
  info: {
    displayName: 'scanTime';
  };
  attributes: {
    date: Attribute.String;
  };
}

export interface SongSongs extends Schema.Component {
  collectionName: 'components_song_songs';
  info: {
    displayName: 'songs';
  };
  attributes: {
    title: Attribute.String;
    file: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
  };
}

export interface YoutubeVideoyoutube extends Schema.Component {
  collectionName: 'components_youtube_videoyoutubes';
  info: {
    displayName: 'videoyoutube';
    icon: 'calendar';
  };
  attributes: {
    videoid: Attribute.String;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'album.song': AlbumSong;
      'member.members': MemberMembers;
      'scan-time.scan-time': ScanTimeScanTime;
      'song.songs': SongSongs;
      'youtube.videoyoutube': YoutubeVideoyoutube;
    }
  }
}
