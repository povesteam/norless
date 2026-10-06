# Login and sessions design

Why login works as the spec says: no passwords, and every method ends in the same check of a verified email.

## Decisions

- **One login path**: Google, the email link and the development login all end in one function that takes a verified email. An invited or active person gets a session and their invitations become active; an unknown email gets a user with no membership (public access plus the note asking for an invitation); an imported person who wasn't invited is refused with that same note. Every method follows the same rules, and a new method needs no role logic.
- **Sessions live in SQLite**: the cookie holds a random 32-byte token, and the table keeps only its SHA-256, so a copy of the database or a backup can't log anyone in. Logging out everywhere and deleting an account must end sessions at once, which stateless signed cookies can't do.
- **Renewal once a day at most**: a 30-day session is extended while in use, but only when more than a day of it has been used, so ordinary requests don't write. Device sessions (`device-login`) are never renewed. Expired rows are deleted at start and daily.
- **The cookie is written by hand**: one cookie, `__Host-session`, HttpOnly, Secure, SameSite=Lax, Path=/. It takes a few lines, so no cookie plugin. The `__Host-` prefix keeps it to this host. Browsers treat `localhost` as secure, so it works in development.
- **Cross-site changes are refused**: SameSite=Lax keeps the cookie off cross-site POSTs. On top of that, any request that isn't GET or HEAD, and the live connection's upgrade, is refused when its `Origin` doesn't match the host. A request with no `Origin` doesn't come from another site's page.
- **Email links resist scanners and forgery**: the email carries the configured app origin, never the request's Host header (a forged Host could send someone's link to another site). The link opens a page with a Log in button, so mail scanners that open links don't use it up. Tokens are stored as hashes, work once, and are deleted a day after they expire.
- **Email links are rate-limited**: an address can ask for 3 links in 15 minutes and the server sends at most 200 an hour, so the form can't be used to flood someone or run up the mail bill. The answer is the same for every address, so it never reveals who is a member. The `next` page after login must be a path on this site.
- **Mail without a library**: Mailgun's HTTP API through `fetch`. With the development login on, each address's last mail is kept and shown by a test-only route.
- **Google by redirect uses the full OpenID Connect flow**: code flow with PKCE, state and nonce (openid-client), scope `openid email profile`, `prompt=select_account` so a shared device doesn't silently reuse the wrong account. The state is also kept in a 10-minute `__Host-google` cookie and must match on return, so a callback link made by someone else can't log a browser in. Only an email Google has verified counts. Logins in progress are kept in memory; a restart sends them back to the login page.
- **Google's own button, checked with jose**: Google's script draws its button (and, on phones and tablets, One Tap) in a frame that knows the browser's Google session, so it can show "Continue as" with the photo while the site learns nothing until the tap. The server verifies the ID token with Google's keys (`jwtVerify`, from jose, the library openid-client already uses), with the issuer, Norless's client as audience, and a nonce.
- **The nonce is per browser and used once**: the page asks the server for a nonce, which is kept in a short `__Host-` cookie and given to Google's script. A token without that browser's nonce is refused, and the cookie goes after one try, so a token taken elsewhere can't be replayed.
- **Only the login page loads Google's script**: someone reading songs loads nothing from Google, and the privacy notice says so. Where the script is blocked, the button goes through the redirect.
- **One Tap on phones and tablets only**: Google is the main way in there. Laptops lead with the QR code (`device-login`), and Google's button waits under "Other ways to log in".
- **No jump when Google's button arrives**: our own button, in Google's look, and Google's sit in one grid cell. Ours shows and takes the clicks (through the redirect) until Google's is drawn. It follows Google's branding rules and is the one button whose icon isn't from Lucide.
- **The development login can't reach production**: it needs `DEV_LOGIN=1`, and the server refuses to start when `NODE_ENV` is `production` (the Docker image sets it). A test covers the refusal.
- **Development looks like production**: the login page has no extra form. Asking for an email link shows the link on the page, marked as development; Google opens a pretend account chooser, a page like the real redirect, listing up to 50 accounts and taking any address. The tests and a developer walk the same screens as a member. The raw development endpoint stays for test helpers.

## Rejected

- Signed stateless cookies (JWT): they can't end a session at once.
- Passwords, and importing the old password hashes: the app has no password to forget or leak, and a shared church device is a poor place to type one.
- Sign in with Apple: it needs a paid Apple Developer account.
- One Tap on other pages, or signing in without a tap: nothing should load from Google, or log anyone in, until the person is on the login page and acts.
- Showing every way in at once, with a second email field for development: confusing; the login page shows the one way that fits the device.
