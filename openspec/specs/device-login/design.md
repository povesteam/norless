# Device login design

Why a laptop or a guest's phone is logged in from a phone that's already logged in, and how that stays safe.

## Decisions

- **The phone approves, so nothing personal touches the laptop**: a shared laptop never holds anyone's Google password or account. The member scans a QR code with Norless on their phone and approves.
- **The code is public, the claim is secret**: the QR and the typed code are visible on the screen, so the waiting page holds a separate random token, and only that page can collect the session once a phone approves. A token works once.
- **Compare a number before approving**: both screens show the same two digits, and the approval must send the number back (wrong number: refused). It stops someone approving a stranger's laptop on the same wifi by mistake. The laptop shows the number only once a phone opened the code, since it's only useful then.
- **A typed code works only while its page shows it**: the login page asks every 2 seconds, and a code counts as shown for 10 seconds after the last ask. That is enough for a slow phone network and too short to guess one of a million codes against closed pages.
- **Pending logins stay in memory**: a code lasts 5 minutes and is renewed while the page waits, capped at 1000 against floods. They are short-lived secrets, so they aren't written to the database; a restart asks for a new code.
- **The nearby offer matches by public address**: browsers can't see the local network, but the server sees a laptop and a phone behind the same public address. Behind the reverse proxy `TRUST_PROXY=1` reads the address from `X-Forwarded-For`; without it, the connection's own address is used.
- **Offers are narrow**: only a computer's login page is offered, since a login page on a phone is someone logging in on their own phone. Only the phones of the laptop's community team get the offer, so an operator's laptop isn't interrupted during a service. Norless must be open on the phone; there are no push notifications for it. The offer waits at the bottom of the phone's page until Review or Not now.
- **Laptops and guests are users of their own**: each has the team role in one community and a name such as "Laptop (Maria)" or "Vlad (guest of Maria)". Role checks, who did what, presence and preferences then work unchanged. The same laptop, or the same guest of the same member, is the same user again. They don't show among the members, can't approve other devices, don't take schedule slots and can't change the member's photo. They go when the member who approved them deletes their account.
- **Team only, whatever the approver's roles**: a shared laptop shouldn't hold an owner's powers. Any team member or owner can approve one.
- **Session lengths**: a laptop's cookie has no expiry (it ends with the browser), and the server also ends it after 12 hours. A guest's phone keeps its cookie for the 4 hours. Device sessions are never renewed.
- **The guest QR goes the other way**: the band member's phone shows a QR, and the guest's phone opens it. The first phone to open it claims it with an id kept in that tab, so a reload keeps working and any other phone finds it run out. Accepting needs the claim too. The pass is for 5 minutes.
- **The band member's page follows the pass**: it follows a live topic that only that member may follow, and shows waiting, then "is in, until" a time, then a new QR after 5 minutes unused. This follows the `live-updates` rule.
- **The device type picks the first way**: laptops get the QR code in a card of about 28rem in the middle of the window, with no Log in button in the header. Phones and tablets get Google first. The email link, and logging in from another phone, wait behind "Other ways to log in". A phone keeps "from another phone" among them because a guest's phone is logged in by a band member scanning or typing its code.
- **Show only what is needed when**: the page shows the QR alone. The typed code appears under "Can't scan?" (for a phone without a camera, My account also takes a code), and the number appears once a phone opened the code.

## Rejected

- Location (GPS) for the nearby offer: laptops rarely have it, and it would ask for permission on both devices.
- Limiting team sessions to the church's network: the QR code has to work from mobile data too.
- Logging in devices without a browser: TVs pair as screens (`screens`).
- Showing the QR, the typed code, the number and an email field together: it was confusing and showed far more than anyone needs at that moment.
