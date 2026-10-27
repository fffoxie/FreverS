# FreverS Endpoint Inventory

| Endpoint ID | Method | Primary Path | Description | Status |
| --- | --- | --- | --- | --- |
| `supported-versions` | `GET` | `/api/Client/SupportedVersions` | Startup version compatibility check (CompatibilityService) | `implemented` |
| `token` | `POST` | `/connect/token` | OAuth password / refresh_token grant (AuthService.LogInAsync / RenewToken) | `implemented` |
| `client-urls` | `GET` | `/api/client/urls` | Service host list (AuthService.GetServicesUrls) | `implemented` |
| `client-urls-post` | `POST` | `/api/client/urls` | POST variant of the service host list | `implemented` |
| `verify-email` | `POST` | `/api/verify-email` | E-mail verification request (AuthService.RequestEmailVerification) | `implemented` |
| `verify-phone-number` | `POST` | `/api/verify-phone-number` | Phone verification request (AuthService.RequestPhoneNumberVerificationCode) | `implemented` |
| `update-username` | `POST` | `/api/credential/username` | Change username (AuthService.UpdateUsername) | `implemented` |
| `update-username-put` | `PUT` | `/api/credential/username` | Change username, PUT variant | `implemented` |
| `age-quiz` | `GET` | `/auth/age-confirmation/quiz` | Age-confirmation quiz (AgeControlService.GetAgeConfirmationQuestions) | `implemented` |
| `age-quiz-post` | `POST` | `/auth/age-confirmation/quiz` | Submit age answers (AgeControlService.ConfirmAgeWithAnswers) | `implemented` |
| `age-quiz-status` | `GET` | `/auth/age-confirmation/quiz/status` | Age-confirmation status (AgeControlService.GetQuizStatus) | `implemented` |
| `follow-recommendations` | `GET` | `/group/follow-recommendations` | RecommendationsService.GetFollowRecommendations | `implemented` |
| `follow-back-recommendations` | `GET` | `/group/follow-back-recommendations` | RecommendationsService.GetFollowBackRecommendations | `implemented` |
| `frever-official` | `GET` | `/group/frever-official` | SocialService.GetFreverOfficialProfile | `implemented` |
| `star-creators` | `GET` | `/group/star-creators-in-your-country` | SocialService.GetStarCreatorsInYourCountry | `implemented` |
| `past-rewards` | `GET` | `/gamification/reward/past` | SeasonService.ClaimPastRewards | `implemented` |
| `me` | `GET` | `/me` | SocialService.CurrentUserProfileInternal | `implemented` |
| `me-balance` | `GET` | `/me/balance` | SocialService.GetUserBalance | `implemented` |
| `health` | `GET` | `/health` | Local health probe (not called by the game) | `implemented` |
| `baking-characters` | `GET` | `/baking/characters` | Wardrobe and character baking list | `implemented` |
| `moderation-wardrobe-availability` | `GET` | `/moderation/wardrobe/baking/availability` | Check wardrobe baking availability | `implemented` |
| `crew-top` | `GET` | `/crew/top` | Crew top and chat endpoints | `implemented` |
| `quests` | `GET` | `/quest` | Quests and daily quest endpoints | `implemented` |
| `moderation-reasons` | `GET` | `/moderation/reasons` | List moderation report reasons | `implemented` |
| `iap-offers` | `GET` | `/purchase/in-app-purchase/offers` | In-app purchase offers (returns empty list, all unlocked) | `implemented` |
