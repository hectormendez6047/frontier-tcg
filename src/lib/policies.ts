import { money } from "./format";
import type { Settings } from "./types";

// Default store policies. The owner can edit every one of these in Admin → Settings → Policies.
// Placeholders filled from Settings: {hours} {location} {prepFee} {freeOver}
// Format: blank line = new paragraph, "## " = heading, "- " = bullet point.

export const POLICY_SLUGS = {
  returns: { key: "policyReturns", title: "Returns & Refunds" },
  shipping: { key: "policyShipping", title: "Shipping Policy" },
  pickup: { key: "policyPickup", title: "Local Pickup" },
  privacy: { key: "policyPrivacy", title: "Privacy Policy" },
  terms: { key: "policyTerms", title: "Terms of Service" },
} as const;
export type PolicySlug = keyof typeof POLICY_SLUGS;

const returns = `Trading cards and sealed product are collectibles whose value depends on condition and on staying sealed, so all sales of cards and sealed product are final. We will always make it right when the mistake is ours.

## When we will refund or replace
- **Damaged in shipping:** the item arrived crushed, bent or broken. Email us within 48 hours of delivery with photos of the item and the packaging, and keep the packaging until we reply.
- **Wrong item:** we sent something different from what you ordered.
- **Not as described:** a single's condition is clearly worse than the condition we listed.
- **Counterfeit or tampered product:** a card is fake, or a pack or box we sold you was resealed or tampered with. We stand behind everything we sell. Bring it to us or email photos and we will refund or replace it.

For pickup orders, please check your bag before you leave. If anything is wrong, tell us on the spot and we will fix it right there.

## What we can't take back
- Opened packs, boxes and other sealed product, except for the counterfeit or tampering cases above.
- Singles and slabs because of a change of mind, a grade you were hoping for, or market prices moving.
- Pulls. What's inside a sealed pack is random, and we can't refund a pack for its contents.

## Accessories
Unopened accessories (sleeves, binders, deck boxes, playmats) can be exchanged or returned for store credit within 14 days with the receipt or order number.

## How to request one
Email us with your order number and photos, or come by the pop-up. We usually reply within 2 days. Approved refunds go back to your original card and normally show up within 5–10 business days. We may ask you to send the item back first. When the mistake is ours, we cover the return shipping.

## Cancellations
You can cancel an order until it has shipped or been bagged for pickup. Email us right away and we will refund the full amount.`;

const shipping = `## Where we ship
We ship within the United States.

## Processing time
Orders ship within 2 business days of payment, usually sooner. You'll get an email with your tracking number once your order ships.

## How we pack
- Singles go in a penny sleeve and a top loader. Higher-value cards are sealed in a team bag and ship in a bubble mailer or box.
- Sealed product and slabs ship in a box with padding.

## Shipping options
- **Tracked shipping:** recommended for every order, and required for sealed product and higher-value cards. Free over the amount shown at checkout.
- **Plain envelope:** a cheaper option for small orders of raw single cards: orders up to $20 and up to 10 cards. Up to 2 cards ship in top loaders; larger envelope orders ship penny-sleeved in a team bag between stiff cardboard. Sealed product, accessories and graded slabs always ship tracked. Envelopes have no tracking, so we can't replace or refund envelopes that get lost or arrive damaged in the mail. Choose tracked shipping if you want your order covered.
- **Bigger card orders:** anything over the envelope limits ships tracked in a padded bubble mailer.

## Lost or damaged packages
For tracked orders, if tracking shows no movement for 7 days or your package arrives damaged, email us within 48 hours of delivery (or of noticing the delay) and we'll file a claim and make it right. Please double-check your address at checkout. We aren't responsible for packages sent to an address entered incorrectly, though we'll help however we can.

## Returns on shipped orders
Shipped cards and sealed product can't be returned unless the item arrived damaged, is the wrong item, is not as described, or is counterfeit or tampered. See our Returns & Refunds policy for details.`;

const pickup = `Skip shipping and pick your order up at our weekend pop-up in Laredo. Online orders come first: we pull your cards and have your bag ready when you get there, so you never wait in line to shop.

## Hours
Our pop-up is open **{hours}** at {location}. The exact spot is also on your order confirmation and our About page.

## How it works
- Order online and choose **Local pickup** at checkout.
- We pull your items, pack them in a Frontier TCG bag sealed with our sticker, and staple your receipt to the bag.
- We email you when your order is bagged and ready. Orders placed during the week are ready on the next pop-up day.
- At pickup, show your confirmation email or order number and tell us your name. Someone else can pick up for you if they have your order number and name.

## Order prep fee
Pickup orders under {freeOver} include a {prepFee} order prep fee. It covers our time to pull, sort and bag your order, including single bulk cards from our numbered storage bins. Pickup orders of {freeOver} or more have no prep fee.

## Holding your order
We hold pickup orders for 14 days. If an order isn't picked up by then, we cancel it and refund it minus the order prep fee. If you need more time, just email us.

## Checking your order
Please open your bag and check your items before you leave. If anything is missing or wrong, we'll fix it on the spot.`;

const privacy = `This policy explains what information Frontier TCG collects on frontiertcgshop.com and how we use it.

## What we collect
- **Order details:** your name, email, phone number (optional), shipping address and what you bought.
- **Account details:** if you make an account, your login email, name, saved addresses, saved cards (favorites) and email preferences.
- **Payment details:** card payments are handled entirely by Square. Your full card number never reaches our servers; we only see the card brand and last four digits.
- **Basic site data:** standard server logs and cookies that keep you signed in and keep your cart.

## How we use it
- To process, ship and support your orders, and to email receipts, shipping updates and refunds.
- To send the newsletters and alerts you signed up for (new products, restocks, events, promotions). Every marketing email has a one-click unsubscribe link, and you can change your choices any time under Account.
- To run Frontier Rewards when it launches.
- To prevent fraud and keep the site secure.

## Who we share it with
We never sell your information. We share only what's needed with the services that run our store: Square (payments), Supabase (our database and logins), Vercel (website hosting), Resend (email delivery), and the shipping carrier for your package.

## Your choices
You can view and edit your account details at any time, unsubscribe from emails, or ask us to delete your account and data by emailing us. We keep order records as long as the law requires for tax and accounting.

## Changes
If we change this policy, we'll post the new version here with an updated date.`;

const terms = `By using frontiertcgshop.com or buying from Frontier TCG, you agree to these terms.

## Products and listings
We describe and photograph items as accurately as we can. Card conditions are graded by us using standard grading terms (Near Mint, Lightly Played and so on). Stock photos may be used for sealed product and some singles.

## Prices and errors
Prices are in US dollars and can change at any time. If an item is listed at the wrong price or is out of stock because of an error, we may cancel the order and fully refund you, even after payment.

## Order limits
We may limit quantities on new releases and high-demand items so more collectors get a chance, and we may cancel orders that look like reselling bots or fraud.

## Sales tax
Texas sales tax is charged on pickup orders and on orders shipped to Texas.

## Pop-up shop
Our in-person pop-up is open {hours}. Hours can change for holidays and events; we'll post changes on the site.

## Rewards and promotions
Rewards, coupons and promotions have no cash value, can't be combined unless we say so, and can be changed or ended at any time. Rewards earned through fraud or abuse may be removed.

## Accounts
Keep your login private. You're responsible for activity on your account. We may close accounts used for fraud or abuse.

## Liability
Our responsibility for any order is limited to the amount you paid for it. Trading cards are collectibles, and we don't guarantee future value or grades.

## Governing law
These terms are governed by the laws of the State of Texas. Questions? Email us any time.`;

export const POLICY_DEFAULTS = {
  policyReturns: returns,
  policyShipping: shipping,
  policyPickup: pickup,
  policyPrivacy: privacy,
  policyTerms: terms,
};

export function fillPolicy(text: string, st: Settings) {
  const free = Number(st.pickupFeeFreeOver) || 0;
  return text
    .replaceAll("{hours}", st.pickupHours || "our posted pop-up hours")
    .replaceAll("{location}", st.pickupLocation || "our pop-up shop in Laredo")
    .replaceAll("{prepFee}", money(Number(st.pickupFee) || 0))
    .replaceAll("{freeOver}", free > 0 ? money(free) : "any amount");
}

