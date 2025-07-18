import type { Schema, Attribute } from '@strapi/strapi';

export interface AdminPermission extends Schema.CollectionType {
  collectionName: 'admin_permissions';
  info: {
    name: 'Permission';
    description: '';
    singularName: 'permission';
    pluralName: 'permissions';
    displayName: 'Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Attribute.JSON & Attribute.DefaultTo<{}>;
    subject: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    properties: Attribute.JSON & Attribute.DefaultTo<{}>;
    conditions: Attribute.JSON & Attribute.DefaultTo<[]>;
    role: Attribute.Relation<'admin::permission', 'manyToOne', 'admin::role'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminUser extends Schema.CollectionType {
  collectionName: 'admin_users';
  info: {
    name: 'User';
    description: '';
    singularName: 'user';
    pluralName: 'users';
    displayName: 'User';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    firstname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    username: Attribute.String;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.Private &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    registrationToken: Attribute.String & Attribute.Private;
    isActive: Attribute.Boolean &
      Attribute.Private &
      Attribute.DefaultTo<false>;
    roles: Attribute.Relation<'admin::user', 'manyToMany', 'admin::role'> &
      Attribute.Private;
    blocked: Attribute.Boolean & Attribute.Private & Attribute.DefaultTo<false>;
    preferedLanguage: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface AdminRole extends Schema.CollectionType {
  collectionName: 'admin_roles';
  info: {
    name: 'Role';
    description: '';
    singularName: 'role';
    pluralName: 'roles';
    displayName: 'Role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    code: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String;
    users: Attribute.Relation<'admin::role', 'manyToMany', 'admin::user'>;
    permissions: Attribute.Relation<
      'admin::role',
      'oneToMany',
      'admin::permission'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface AdminApiToken extends Schema.CollectionType {
  collectionName: 'strapi_api_tokens';
  info: {
    name: 'Api Token';
    singularName: 'api-token';
    pluralName: 'api-tokens';
    displayName: 'Api Token';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    type: Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Attribute.Required &
      Attribute.DefaultTo<'read-only'>;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      'admin::api-token',
      'oneToMany',
      'admin::api-token-permission'
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_api_token_permissions';
  info: {
    name: 'API Token Permission';
    description: '';
    singularName: 'api-token-permission';
    pluralName: 'api-token-permissions';
    displayName: 'API Token Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      'admin::api-token-permission',
      'manyToOne',
      'admin::api-token'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferToken extends Schema.CollectionType {
  collectionName: 'strapi_transfer_tokens';
  info: {
    name: 'Transfer Token';
    singularName: 'transfer-token';
    pluralName: 'transfer-tokens';
    displayName: 'Transfer Token';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      'admin::transfer-token',
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    name: 'Transfer Token Permission';
    description: '';
    singularName: 'transfer-token-permission';
    pluralName: 'transfer-token-permissions';
    displayName: 'Transfer Token Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      'admin::transfer-token-permission',
      'manyToOne',
      'admin::transfer-token'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFile extends Schema.CollectionType {
  collectionName: 'files';
  info: {
    singularName: 'file';
    pluralName: 'files';
    displayName: 'File';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    alternativeText: Attribute.String;
    caption: Attribute.String;
    width: Attribute.Integer;
    height: Attribute.Integer;
    formats: Attribute.JSON;
    hash: Attribute.String & Attribute.Required;
    ext: Attribute.String;
    mime: Attribute.String & Attribute.Required;
    size: Attribute.Decimal & Attribute.Required;
    url: Attribute.String & Attribute.Required;
    previewUrl: Attribute.String;
    provider: Attribute.String & Attribute.Required;
    provider_metadata: Attribute.JSON;
    related: Attribute.Relation<'plugin::upload.file', 'morphToMany'>;
    folder: Attribute.Relation<
      'plugin::upload.file',
      'manyToOne',
      'plugin::upload.folder'
    > &
      Attribute.Private;
    folderPath: Attribute.String &
      Attribute.Required &
      Attribute.Private &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFolder extends Schema.CollectionType {
  collectionName: 'upload_folders';
  info: {
    singularName: 'folder';
    pluralName: 'folders';
    displayName: 'Folder';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    pathId: Attribute.Integer & Attribute.Required & Attribute.Unique;
    parent: Attribute.Relation<
      'plugin::upload.folder',
      'manyToOne',
      'plugin::upload.folder'
    >;
    children: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.folder'
    >;
    files: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.file'
    >;
    path: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesRelease extends Schema.CollectionType {
  collectionName: 'strapi_releases';
  info: {
    singularName: 'release';
    pluralName: 'releases';
    displayName: 'Release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    releasedAt: Attribute.DateTime;
    scheduledAt: Attribute.DateTime;
    timezone: Attribute.String;
    status: Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Attribute.Required;
    actions: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Schema.CollectionType {
  collectionName: 'strapi_release_actions';
  info: {
    singularName: 'release-action';
    pluralName: 'release-actions';
    displayName: 'Release Action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    type: Attribute.Enumeration<['publish', 'unpublish']> & Attribute.Required;
    entry: Attribute.Relation<
      'plugin::content-releases.release-action',
      'morphToOne'
    >;
    contentType: Attribute.String & Attribute.Required;
    locale: Attribute.String;
    release: Attribute.Relation<
      'plugin::content-releases.release-action',
      'manyToOne',
      'plugin::content-releases.release'
    >;
    isEntryValid: Attribute.Boolean;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Schema.CollectionType {
  collectionName: 'up_permissions';
  info: {
    name: 'permission';
    description: '';
    singularName: 'permission';
    pluralName: 'permissions';
    displayName: 'Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String & Attribute.Required;
    role: Attribute.Relation<
      'plugin::users-permissions.permission',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole extends Schema.CollectionType {
  collectionName: 'up_roles';
  info: {
    name: 'role';
    description: '';
    singularName: 'role';
    pluralName: 'roles';
    displayName: 'Role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    description: Attribute.String;
    type: Attribute.String & Attribute.Unique;
    permissions: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    users: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsUser extends Schema.CollectionType {
  collectionName: 'up_users';
  info: {
    name: 'user';
    description: '';
    singularName: 'user';
    pluralName: 'users';
    displayName: 'User';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    username: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Attribute.String;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    confirmationToken: Attribute.String & Attribute.Private;
    confirmed: Attribute.Boolean & Attribute.DefaultTo<false>;
    blocked: Attribute.Boolean & Attribute.DefaultTo<false>;
    role: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    qrs: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::qr.qr'
    >;
    albums: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::album.album'
    >;
    events: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::event.event'
    >;
    bands: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::band.band'
    >;
    tours: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::tour.tour'
    >;
    streams: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::stream.stream'
    >;
    socialpages: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::socialpage.socialpage'
    >;
    videos: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::video.video'
    >;
    subscriptionStatus: Attribute.Enumeration<
      [
        'active',
        'trialing',
        'pastDue',
        'canceled',
        'unpaid',
        'past_due',
        'free'
      ]
    > &
      Attribute.DefaultTo<'trialing'>;
    subscriptionId: Attribute.String;
    customerId: Attribute.String;
    trialEndsAt: Attribute.Date;
    gracePeriodStart: Attribute.Date;
    cancelAt: Attribute.Date;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginI18NLocale extends Schema.CollectionType {
  collectionName: 'i18n_locale';
  info: {
    singularName: 'locale';
    pluralName: 'locales';
    collectionName: 'locales';
    displayName: 'Locale';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.SetMinMax<
        {
          min: 1;
          max: 50;
        },
        number
      >;
    code: Attribute.String & Attribute.Unique;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiAlbumAlbum extends Schema.CollectionType {
  collectionName: 'albums';
  info: {
    singularName: 'album';
    pluralName: 'albums';
    displayName: 'Album';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    releaseDate: Attribute.Date & Attribute.Required;
    cover: Attribute.Media<'images'>;
    songs: Attribute.Component<'album.song', true>;
    band: Attribute.Relation<'api::album.album', 'manyToOne', 'api::band.band'>;
    users_permissions_user: Attribute.Relation<
      'api::album.album',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    streamingService: Attribute.Enumeration<
      [
        'Spotify',
        'Apple Music',
        'YouTube Music',
        'Amazon Music',
        'Tidal',
        'Deezer'
      ]
    >;
    albumId: Attribute.String;
    albumUrl: Attribute.String;
    embedUrl: Attribute.String;
    isApproved: Attribute.Boolean & Attribute.DefaultTo<true>;
    type: Attribute.String;
    gallery: Attribute.Component<'gallery.gallery', true>;
    biotagline: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::album.album',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::album.album',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiBandBand extends Schema.CollectionType {
  collectionName: 'bands';
  info: {
    singularName: 'band';
    pluralName: 'bands';
    displayName: 'Band';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    genre: Attribute.String & Attribute.Required;
    bio: Attribute.Text &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        maxLength: 247;
      }>;
    bandImg: Attribute.Media<'images'>;
    members: Attribute.Component<'member.members', true>;
    facebook: Attribute.String;
    instagram: Attribute.String;
    twitch: Attribute.String;
    appleMusic: Attribute.String;
    soundcloud: Attribute.String;
    albums: Attribute.Relation<
      'api::band.band',
      'oneToMany',
      'api::album.album'
    >;
    events: Attribute.Relation<
      'api::band.band',
      'oneToMany',
      'api::event.event'
    >;
    users_permissions_user: Attribute.Relation<
      'api::band.band',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    tours: Attribute.Relation<'api::band.band', 'manyToMany', 'api::tour.tour'>;
    deezer: Attribute.String;
    youtube: Attribute.String;
    bandcamp: Attribute.String;
    videos: Attribute.Relation<
      'api::band.band',
      'manyToMany',
      'api::video.video'
    >;
    twitter: Attribute.String;
    whatsapp: Attribute.String;
    tiktok: Attribute.String;
    media_plays: Attribute.Relation<
      'api::band.band',
      'oneToMany',
      'api::media-play.media-play'
    >;
    singlesong: Attribute.Component<'singlesong.singlesong'>;
    singlevideo: Attribute.Component<'singlevideo.singlevideo'>;
    spotify: Attribute.String;
    snapchat: Attribute.String;
    websitelink: Attribute.String;
    websitelinktext: Attribute.String;
    biotagline: Attribute.String;
    link_clicks: Attribute.Relation<
      'api::band.band',
      'oneToMany',
      'api::link-click.link-click'
    >;
    reverbnation: Attribute.String;
    isBandNameInLogo: Attribute.Boolean & Attribute.DefaultTo<false>;
    slug: Attribute.String & Attribute.Unique;
    band_page_views: Attribute.Relation<
      'api::band.band',
      'oneToMany',
      'api::band-page-view.band-page-view'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::band.band', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::band.band', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiBandPageViewBandPageView extends Schema.CollectionType {
  collectionName: 'band_page_views';
  info: {
    singularName: 'band-page-view';
    pluralName: 'band-page-views';
    displayName: 'band-page-view';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    band: Attribute.Relation<
      'api::band-page-view.band-page-view',
      'manyToOne',
      'api::band.band'
    >;
    timestamp: Attribute.DateTime;
    ipAddress: Attribute.String;
    userAgent: Attribute.String;
    referrer: Attribute.String;
    path: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::band-page-view.band-page-view',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::band-page-view.band-page-view',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiEventEvent extends Schema.CollectionType {
  collectionName: 'events';
  info: {
    singularName: 'event';
    pluralName: 'events';
    displayName: 'Event';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    title: Attribute.String;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    date: Attribute.Date;
    time: Attribute.Time;
    link: Attribute.String;
    band: Attribute.Relation<'api::event.event', 'manyToOne', 'api::band.band'>;
    contactPhone: Attribute.String;
    ageRestriction: Attribute.String;
    users_permissions_user: Attribute.Relation<
      'api::event.event',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    venue: Attribute.String;
    city: Attribute.String;
    state: Attribute.String;
    address: Attribute.String;
    facebook: Attribute.String;
    twitter: Attribute.String;
    instagram: Attribute.String;
    youtube: Attribute.String;
    tiktok: Attribute.String;
    website: Attribute.String;
    isApproved: Attribute.Boolean & Attribute.DefaultTo<true>;
    description: Attribute.JSON;
    slug: Attribute.String & Attribute.Unique;
    event_page_views: Attribute.Relation<
      'api::event.event',
      'oneToMany',
      'api::event-page-view.event-page-view'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::event.event',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::event.event',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiEventPageViewEventPageView extends Schema.CollectionType {
  collectionName: 'event_page_views';
  info: {
    singularName: 'event-page-view';
    pluralName: 'event-page-views';
    displayName: 'Event Page View';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    timestamp: Attribute.DateTime;
    ipAddress: Attribute.String;
    userAgent: Attribute.String;
    referrer: Attribute.String;
    path: Attribute.String;
    title: Attribute.String;
    event: Attribute.Relation<
      'api::event-page-view.event-page-view',
      'manyToOne',
      'api::event.event'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::event-page-view.event-page-view',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::event-page-view.event-page-view',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiFuntestFuntest extends Schema.CollectionType {
  collectionName: 'funtests';
  info: {
    singularName: 'funtest';
    pluralName: 'funtests';
    displayName: 'funtest';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    testingsomething: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::funtest.funtest',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::funtest.funtest',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiLinkClickLinkClick extends Schema.CollectionType {
  collectionName: 'link_clicks';
  info: {
    singularName: 'link-click';
    pluralName: 'link-clicks';
    displayName: 'link-click';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    band: Attribute.Relation<
      'api::link-click.link-click',
      'manyToOne',
      'api::band.band'
    >;
    platform: Attribute.String;
    clickCount: Attribute.Integer & Attribute.DefaultTo<0>;
    timestamp: Attribute.DateTime;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::link-click.link-click',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::link-click.link-click',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiMediaPlayMediaPlay extends Schema.CollectionType {
  collectionName: 'media_plays';
  info: {
    singularName: 'media-play';
    pluralName: 'media-plays';
    displayName: 'Media Play';
    description: 'Tracks each time a user plays the featured song or video';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    band: Attribute.Relation<
      'api::media-play.media-play',
      'manyToOne',
      'api::band.band'
    >;
    mediaType: Attribute.Enumeration<['song', 'video']> & Attribute.Required;
    title: Attribute.String & Attribute.Required;
    timestamp: Attribute.DateTime;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::media-play.media-play',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::media-play.media-play',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiQrQr extends Schema.CollectionType {
  collectionName: 'qrs';
  info: {
    singularName: 'qr';
    pluralName: 'qrs';
    displayName: 'Qr';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    q_image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    url: Attribute.String;
    q_type: Attribute.String;
    band: Attribute.Relation<'api::qr.qr', 'oneToOne', 'api::band.band'>;
    users_permissions_user: Attribute.Relation<
      'api::qr.qr',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    link: Attribute.String;
    name: Attribute.String;
    scanTime: Attribute.Component<'scan-time.scan-time', true>;
    options: Attribute.JSON;
    album: Attribute.Relation<'api::qr.qr', 'oneToOne', 'api::album.album'>;
    event: Attribute.Relation<'api::qr.qr', 'oneToOne', 'api::event.event'>;
    tour: Attribute.Relation<'api::qr.qr', 'oneToOne', 'api::tour.tour'>;
    scans: Attribute.Relation<'api::qr.qr', 'oneToMany', 'api::scan.scan'>;
    slugId: Attribute.String;
    arEnabled: Attribute.Boolean & Attribute.DefaultTo<false>;
    template: Attribute.Enumeration<['video', 'song', 'event', 'test']> &
      Attribute.DefaultTo<'video'>;
    videoId: Attribute.String;
    songUrl: Attribute.String;
    eventPosterUrl: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::qr.qr', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::qr.qr', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiScanScan extends Schema.CollectionType {
  collectionName: 'scans';
  info: {
    singularName: 'scan';
    pluralName: 'scans';
    displayName: 'Scan';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    date: Attribute.DateTime;
    custom: Attribute.JSON;
    qr: Attribute.Relation<'api::scan.scan', 'manyToOne', 'api::qr.qr'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::scan.scan', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::scan.scan', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiSeoPageSeoPage extends Schema.CollectionType {
  collectionName: 'seo_pages';
  info: {
    singularName: 'seo-page';
    pluralName: 'seo-pages';
    displayName: 'seo-page';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String;
    slug: Attribute.UID<'api::seo-page.seo-page', 'title'>;
    metaTitle: Attribute.String;
    metaDescription: Attribute.String;
    ogImage: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    content: Attribute.RichText;
    featured: Attribute.Boolean;
    keywords: Attribute.String;
    category: Attribute.Enumeration<
      [
        'qr-code-strategy',
        'smart-links',
        'fan-funnels',
        'touring-events',
        'music-marketing',
        'merch-growth',
        'analytics',
        'case-studies'
      ]
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::seo-page.seo-page',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::seo-page.seo-page',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSocialpageSocialpage extends Schema.CollectionType {
  collectionName: 'socialpages';
  info: {
    singularName: 'socialpage';
    pluralName: 'socialpages';
    displayName: 'socialpage';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    facebook: Attribute.String;
    snapchat: Attribute.String;
    whatsapp: Attribute.String;
    twitch: Attribute.String;
    tictok: Attribute.String;
    img: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Attribute.String;
    users_permissions_user: Attribute.Relation<
      'api::socialpage.socialpage',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    band: Attribute.Relation<
      'api::socialpage.socialpage',
      'oneToOne',
      'api::band.band'
    >;
    instagram: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::socialpage.socialpage',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::socialpage.socialpage',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiStreamStream extends Schema.CollectionType {
  collectionName: 'streams';
  info: {
    singularName: 'stream';
    pluralName: 'streams';
    displayName: 'stream';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    applemusic: Attribute.String;
    spotify: Attribute.String;
    soundcloud: Attribute.String;
    youtubemusic: Attribute.String;
    users_permissions_user: Attribute.Relation<
      'api::stream.stream',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    img: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    bandTitle: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::stream.stream',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::stream.stream',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTourTour extends Schema.CollectionType {
  collectionName: 'tours';
  info: {
    singularName: 'tour';
    pluralName: 'tours';
    displayName: 'tour';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String;
    startDate: Attribute.Date;
    endDate: Attribute.Date;
    events: Attribute.Relation<
      'api::tour.tour',
      'oneToMany',
      'api::event.event'
    >;
    bands: Attribute.Relation<'api::tour.tour', 'manyToMany', 'api::band.band'>;
    users_permissions_user: Attribute.Relation<
      'api::tour.tour',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    description: Attribute.Text;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::tour.tour', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::tour.tour', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiVideoVideo extends Schema.CollectionType {
  collectionName: 'videos';
  info: {
    singularName: 'video';
    pluralName: 'videos';
    displayName: 'video';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    users_permissions_users: Attribute.Relation<
      'api::video.video',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    mediayoutube: Attribute.Component<'youtube.videoyoutube', true>;
    bandImg: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    bandlink: Attribute.String;
    bandname: Attribute.String;
    title: Attribute.String;
    bands: Attribute.Relation<
      'api::video.video',
      'manyToMany',
      'api::band.band'
    >;
    isApproved: Attribute.Boolean & Attribute.DefaultTo<true>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::video.video',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::video.video',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface ContentTypes {
      'admin::permission': AdminPermission;
      'admin::user': AdminUser;
      'admin::role': AdminRole;
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
      'plugin::i18n.locale': PluginI18NLocale;
      'api::album.album': ApiAlbumAlbum;
      'api::band.band': ApiBandBand;
      'api::band-page-view.band-page-view': ApiBandPageViewBandPageView;
      'api::event.event': ApiEventEvent;
      'api::event-page-view.event-page-view': ApiEventPageViewEventPageView;
      'api::funtest.funtest': ApiFuntestFuntest;
      'api::link-click.link-click': ApiLinkClickLinkClick;
      'api::media-play.media-play': ApiMediaPlayMediaPlay;
      'api::qr.qr': ApiQrQr;
      'api::scan.scan': ApiScanScan;
      'api::seo-page.seo-page': ApiSeoPageSeoPage;
      'api::socialpage.socialpage': ApiSocialpageSocialpage;
      'api::stream.stream': ApiStreamStream;
      'api::tour.tour': ApiTourTour;
      'api::video.video': ApiVideoVideo;
    }
  }
}
