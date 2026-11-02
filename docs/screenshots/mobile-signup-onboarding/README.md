# Native sign-up and onboarding preview

2 Nov 2026. Screenshots show an isolated Expo web export, fake account and mocked API/auth responses at 390px and 1440px. All other external traffic is blocked. No health answers in these screenshots were sent to shared storage, and no paid AI endpoint was called.

Separate mocked checks cover confirmation-required sign-up and auth rejection: neither made a profile API call, neither had page errors, and confirmation cleared the password before returning to sign-in.

The walkthrough covers create account → seven questions → editable rhythm summary → simulated save failure → explicit retry → Today, then Settings → Update your rhythm → Cancel. Browser checks found no page errors or horizontal overflow; measured action heights were at least 48px. `large-text` images simulate 1.8× text; this does not establish native Dynamic Type or VoiceOver behavior. The 390px walkthrough uses normal motion and 1440px reduced motion. Before/during/after summary frames use a controlled browser clock; the ring fades for the shared reveal duration while text/actions remain immediately available.

Self-critique: removed repeated sleep description and the duplicate hours row from the summary, retaining separate controls to edit the schedule and actual hours. Layout remains a scrolling column with wrapping text and no fixed text heights. Initial development-preview auth configuration did not match the fake host, so that attempt was stopped after an already-registered rejection; final evidence comes from the isolated export with blocked external traffic.

Nazmul tested M1 on his iPhone and reported the other behavior was OK, asking for a clock picker in question 2 and authorizing PR creation. The subsequent native picker is covered by iOS/Android behavior tests and native bundle exports; the web screenshots use the browser time input, not the iOS/Android picker. No second physical-picker test or Android-device verification is claimed. Motion frames are also collected under [ui-motion/mobile-onboarding-m1](../ui-motion/mobile-onboarding-m1/).
