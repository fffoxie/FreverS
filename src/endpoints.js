import {
  login,
  updateUsername,
  requestVerification,
  registerTemporaryAccount,
  parentalConsent,
  validatePassword,
  suggestNicknames
} from './handlers-auth.js';
import {
  versions,
  urls,
  ageQuiz,
  confirmAge,
  emptyArray,
  officialProfile,
  pastRewards,
  currentUser,
  currentBalance,
  getGroup,
  starCreators,
  bakingCharacters,
  moderationWardrobeAvailability,
  crewsList,
  questsList,
  moderationReasons,
  inAppPurchaseOffers,
  assetMaps,
  assetAnimations
} from './handlers-data.js';

/**
 * Route table. `paths` contains the confirmed path plus aliases that the same
 * handler accepts where the exact prefix (auth base URL / api version) could
 * not be recovered from the stripped binary. See docs/protocol.md.
 */
export const endpoints = [
  {
    id: 'supported-versions',
    method: 'GET',
    paths: [
      '/api/Client/SupportedVersions',
      '/api/client/SupportedVersions',
      '/api/client/supportedversions',
      '/api/Client/supportedVersions'
    ],
    handler: versions,
    description: 'Startup version compatibility check (CompatibilityService)'
  },
  {
    id: 'token',
    method: 'POST',
    paths: [
      '/connect/token',
      '/auth/connect/token',
      '/api/connect/token',
      '/api/auth/connect/token',
      '/4.0.5/connect/token',
      '/auth/4.0.5/connect/token',
      '/api/4.0.5/connect/token'
    ],
    handler: login,
    description: 'OAuth password / refresh_token grant (AuthService.LogInAsync / RenewToken)'
  },
  {
    id: 'client-urls',
    method: 'GET',
    paths: [
      '/api/client/urls',
      '/auth/api/client/urls',
      '/api/Client/urls',
      '/api/client/Urls',
      '/api/api/client/urls',
      '/auth/api/api/client/urls'
    ],
    handler: urls,
    description: 'Service host list (AuthService.GetServicesUrls)'
  },
  {
    id: 'client-urls-post',
    method: 'POST',
    paths: ['/api/client/urls', '/auth/api/client/urls'],
    handler: urls,
    description: 'POST variant of the service host list'
  },
  {
    id: 'verify-email',
    method: 'POST',
    paths: ['/api/verify-email'],
    handler: requestVerification,
    description: 'E-mail verification request (AuthService.RequestEmailVerification)'
  },
  {
    id: 'verify-phone-number',
    method: 'POST',
    paths: ['/api/verify-phone-number'],
    handler: requestVerification,
    description: 'Phone verification request (AuthService.RequestPhoneNumberVerificationCode)'
  },
  {
    id: 'update-username',
    method: 'POST',
    paths: ['/api/credential/username'],
    handler: updateUsername,
    description: 'Change username (AuthService.UpdateUsername)'
  },
  {
    id: 'update-username-put',
    method: 'PUT',
    paths: ['/api/credential/username'],
    handler: updateUsername,
    description: 'Change username, PUT variant'
  },
  {
    id: 'age-quiz',
    method: 'GET',
    paths: ['/auth/age-confirmation/quiz'],
    handler: ageQuiz,
    description: 'Age-confirmation quiz (AgeControlService.GetAgeConfirmationQuestions)'
  },
  {
    id: 'age-quiz-post',
    method: 'POST',
    paths: ['/auth/age-confirmation/quiz'],
    handler: confirmAge,
    description: 'Submit age answers (AgeControlService.ConfirmAgeWithAnswers)'
  },
  {
    id: 'age-quiz-status',
    method: 'GET',
    paths: ['/auth/age-confirmation/quiz/status'],
    handler: ageQuiz,
    description: 'Age-confirmation status (AgeControlService.GetQuizStatus)'
  },
  {
    id: 'follow-recommendations',
    method: 'GET',
    paths: ['/group/follow-recommendations'],
    handler: emptyArray,
    description: 'RecommendationsService.GetFollowRecommendations'
  },
  {
    id: 'follow-back-recommendations',
    method: 'GET',
    paths: ['/group/follow-back-recommendations'],
    handler: emptyArray,
    description: 'RecommendationsService.GetFollowBackRecommendations'
  },
  {
    id: 'frever-official',
    method: 'GET',
    paths: ['/group/frever-official'],
    handler: officialProfile,
    description: 'SocialService.GetFreverOfficialProfile'
  },
  {
    id: 'star-creators',
    method: 'GET',
    paths: [
      '/group/star-creators-in-your-country',
      '/group/public/group/star-creators-in-your-country'
    ],
    handler: starCreators,
    description: 'SocialService.GetStarCreatorsInYourCountry'
  },
  {
    id: 'past-rewards',
    method: 'GET',
    paths: ['/gamification/reward/past'],
    handler: pastRewards,
    description: 'SeasonService.ClaimPastRewards'
  },
  {
    id: 'me',
    method: 'GET',
    paths: ['/me'],
    handler: currentUser,
    description: 'SocialService.CurrentUserProfileInternal'
  },
  {
    id: 'me-balance',
    method: 'GET',
    paths: ['/me/balance'],
    handler: currentBalance,
    description: 'SocialService.GetUserBalance'
  },
  {
    id: 'health',
    method: 'GET',
    paths: ['/health', '/healthz'],
    handler: () => ({ body: { status: 'ok', service: 'frevers', version: '0.1.0' } }),
    description: 'Local health probe (not called by the game)'
  },
  {
    id: 'baking-characters',
    method: 'GET',
    paths: ['/baking/characters'],
    handler: bakingCharacters,
    description: 'Wardrobe and character baking list'
  },
  {
    id: 'moderation-wardrobe-availability',
    method: 'GET',
    paths: ['/moderation/wardrobe/baking/availability'],
    handler: moderationWardrobeAvailability,
    description: 'Check wardrobe baking availability'
  },
  {
    id: 'crew-top',
    method: 'GET',
    paths: ['/crew/top', '/crew/my/chat'],
    handler: crewsList,
    description: 'Crew top and chat endpoints'
  },
  {
    id: 'quests',
    method: 'GET',
    paths: ['/quest', '/daily-quest'],
    handler: questsList,
    description: 'Quests and daily quest endpoints'
  },
  {
    id: 'moderation-reasons',
    method: 'GET',
    paths: ['/moderation/reasons'],
    handler: moderationReasons,
    description: 'List moderation report reasons'
  },
  {
    id: 'iap-offers',
    method: 'GET',
    paths: ['/purchase/in-app-purchase/offers'],
    handler: inAppPurchaseOffers,
    description: 'In-app purchase offers (returns empty list, all unlocked)'
  },
  {
    id: 'asset-maps',
    method: 'GET',
    paths: ['/assets/maps'],
    handler: assetMaps,
    description: 'List available studio maps inventory'
  },
  {
    id: 'asset-animations',
    method: 'GET',
    paths: ['/assets/animations'],
    handler: assetAnimations,
    description: 'List available studio animations inventory'
  }
];

export function normalizePath(pathname) {
  let value = pathname.replace(/\/{2,}/g, '/');
  if (value.length > 1) value = value.replace(/\/+$/, '');
  return value;
}

export function matchEndpoint(method, pathname) {
  const path = normalizePath(pathname);
  for (const endpoint of endpoints) {
    if (endpoint.method !== method) continue;
    for (const candidate of endpoint.paths) {
      if (candidate === path) return { endpoint, params: {} };
    }
  }
  // GET /group/{id} - SocialService.GetBaseProfileInternal builds "group/{0}".
  if (method === 'GET') {
    const match = /^\/group\/([^/]+)$/.exec(path);
    if (match) {
      return {
        endpoint: { id: 'group-profile', handler: getGroup, description: 'Profile by group id' },
        params: { id: decodeURIComponent(match[1]) }
      };
    }
  }
  // The auth base URL could not be reconstructed exactly (auth/<version>).
  // Any POST that ends in /connect/token is the token endpoint.
  if (method === 'POST' && /\/connect\/token$/.test(path)) {
    return { endpoint: { id: 'token-suffix', handler: login, description: 'Token endpoint (suffix alias)' }, params: {} };
  }
  return null;
}
