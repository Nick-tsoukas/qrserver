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

export interface GalleryGallery extends Schema.Component {
  collectionName: 'components_gallery_galleries';
  info: {
    displayName: 'gallery';
  };
  attributes: {
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
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

export interface SinglesongSinglesong extends Schema.Component {
  collectionName: 'components_singlesong_singlesongs';
  info: {
    displayName: 'singlesong';
    icon: 'earth';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    song: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    embedUrl: Attribute.String;
    isEmbeded: Attribute.Boolean;
  };
}

export interface SinglevideoSinglevideo extends Schema.Component {
  collectionName: 'components_singlevideo_singlevideos';
  info: {
    displayName: 'singlevideo';
    icon: 'calendar';
  };
  attributes: {
    title: Attribute.String;
    youtubeid: Attribute.String;
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

export interface SpotifySpotify extends Schema.Component {
  collectionName: 'components_spotify_spotifies';
  info: {
    displayName: 'spotify';
    icon: 'cast';
  };
  attributes: {
    spotifyAlbumId: Attribute.String;
    embedUrl: Attribute.String;
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
      'gallery.gallery': GalleryGallery;
      'member.members': MemberMembers;
      'scan-time.scan-time': ScanTimeScanTime;
      'singlesong.singlesong': SinglesongSinglesong;
      'singlevideo.singlevideo': SinglevideoSinglevideo;
      'song.songs': SongSongs;
      'spotify.spotify': SpotifySpotify;
      'youtube.videoyoutube': YoutubeVideoyoutube;
    }
  }
}
