# Report reason fallback

Final web captures at [390px](390-report.png) and [1440px](1440-report.png), checked 31 Oct 2026. Supabase auth and API responses were mocked; a valid string reason code unknown to the frontend was added to the report fixture. Under “Signal or noise”, the new bullet reads “We don't have an explanation for this detail yet.” Known reasons retain their explanations.

The report was also checked at 768px. There were no real proposal/report calls or shared database writes. These captures verify the web fallback; native typography is covered by the shared-brand tests, and the native app follows in a later PR.
