import config from './config.js';

let runtimeBaseUrl = config.publicBaseUrl;

export function setPublicBaseUrl(url) {
  runtimeBaseUrl = String(url).replace(/\/+$/, '');
}

function base() {
  return runtimeBaseUrl;
}


export function supportedVersions() {
  return { ...config.supportedVersions };
}

export function tokenResponse(accessToken, refreshToken) {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    // Extra OAuth fields (not in the client's TokenResponse class, harmless).
    token_type: 'Bearer',
    expires_in: config.accessTokenTtlSeconds,
    // TokenResponse fields recovered from Bridge.Authorization.TokenResponse.
    server_url: base(),
    transcoding_server: base(),
    video_server: base(),
    social_server: base(),
    notification_server: base(),
    client_server: base(),
    chat_server: base(),
    assetmanager_server: base()
  };
}

export function servicesUrls() {
  // Models.Client.ServicesUrls
  return {
    Main: base(),
    Asset: base(),
    Transcoding: base(),
    Video: base(),
    Social: base(),
    Notification: base(),
    AssetManager: base(),
    Chat: base(),
    Client: base()
  };
}

export function userBalance(user) {
  return {
    SoftCurrencyAmount: Number(user?.soft_currency ?? 0),
    HardCurrencyAmount: Number(user?.hard_currency ?? 0)
  };
}

export function profileKpi() {
  return {
    FollowersCount: 0,
    FollowingCount: 0,
    VideoLikesCount: 0,
    PublishedVideoCount: 0,
    TotalVideoCount: 0,
    TaggedInVideoCount: 0,
    TotalDraftsCount: 0,
    TotalLevelsCount: 0,
    TaskVideoCount: 0,
    FriendsCount: 0
  };
}

/**
 * Bridge.Services.UserProfile.Profile. Only fields documented from the IL2CPP
 * dump are emitted; unknown/unused nested models are null and the client's
 * Newtonsoft deserializer leaves its own defaults in place.
 */
export function profile(user) {
  return {
    MainGroupId: Number(user.group_id),
    NickName: user.nickname,
    CreatorScoreBadge: 0,
    KPI: profileKpi(),
    MainCharacter: null,
    YouFollowUser: false,
    UserFollowsYou: false,
    CharacterAccess: 0,
    Bio: '',
    BioLinks: {},
    CrewProfile: null,
    IsMinor: false,
    AllowChat: true,
    IsNewFriend: false,
    ChatAvailableAfterTime: '0001-01-01T00:00:00Z'
  };
}

export function myProfile(user) {
  // Bridge.Services.UserProfile.MyProfile + the identity fields the bridge
  // reads from the JWT (Id/GroupId/Email are added as harmless aliases).
  return {
    Id: Number(user.id),
    GroupId: Number(user.group_id),
    Email: user.email,
    Nickname: user.nickname,
    MainCharacterId: user.main_character_id ?? null,
    MainCharacterIds: [],
    TaxationCountryId: null,
    IsBlocked: false,
    IsEmployee: Boolean(user.is_employee),
    IsFeatured: false,
    DataCollectionEnabled: null,
    BirthDate: null,
    GenderId: null,
    AnalyticsEnabled: false,
    UserBalance: userBalance(user),
    LevelingProgress: null,
    CharacterAccess: 0,
    RegistrationDate: user.created_at ? `${user.created_at.replace(' ', 'T')}Z` : '1970-01-01T00:00:00Z',
    IsPremium: Boolean(user.premium_until && new Date(user.premium_until) > new Date()),
    PremiumUntil: user.premium_until || null,
    IsAdmin: Boolean(user.is_admin),
    AvatarUrl: user.avatar_asset_id ? `/assets/${user.avatar_asset_id}` : null,
    IsStarCreator: false,
    IsStarCreatorCandidate: false,
    FeatureSettings: null,
    OnboardingTasksCompleted: true,
    Bio: '',
    BioLinks: {},
    SupportedStarCreator: null,
    DetectedLocationCountry: null,
    MusicEnabled: true,
    IsMinor: false,
    AdvertisingTrackingEnabled: false,
    ParentalConsent: null,
    IsParentAgeValidated: true,
    IsInAppPurchaseAllowed: true,
    EmailRedacted: user.email.replace(/^(.).*(@.*)$/, '$1***$2'),
    IsNicknameChangeAllowed: true,
    IsOnboardingCompleted: Boolean(user.onboarding_completed),
    InitialAccountBalance: null,
    UsernameUpdateAvailableOn: null,
    HasDefaultUsername: true,
    HasUpdatedCredentials: false
  };
}

export function followRecommendation() {
  // Bridge.Models.ClientServer.Recommendations.FollowRecommendation
  return { Group: null, Reason: 'Personalized', CommonFriends: [] };
}

export function ageQuizResponse({ confirmed = true, runOutOfQuestions = true, questions = [] } = {}) {
  // Bridge.Models.ClientServer.AgeConfirmationQuizResponse
  return { IsAgeConfirmed: confirmed, IsRunOutOfQuestions: runOutOfQuestions, Questions: questions };
}

export function claimPastRewards() {
  // Bridge.Models.ClientServer.Gamification.ClaimPastRewardsResult
  return { RewardCount: 0, SoftCurrency: 0, HardCurrency: 0, Assets: [] };
}
