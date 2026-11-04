# Optional support, with every tool free

The support page contains 14 public receiving routes explicitly supplied by the owner. Five are USDT: Ethereum ERC-20, TRON TRC-20, BNB Smart Chain BEP-20, Polygon PoS, and Avalanche C-Chain. Additional supplied assets are BTC, ETH, SOL, TWT, TRX, DOGE, POL, XRP, and BCH. The entry the owner labelled USDC contained a duplicate USDT contract/link and was not published as USDC.

## Add another network

Edit `src/donations/receiving.json`, using the exact asset, network, public receiving address and asset ID from the owner's Trust Wallet Receive link. Never infer another chain from a matching address. One entry represents one asset/network pair; it is unnecessary to reproduce the entire wallet catalog. Names and network labels must match the receiving link. Only public receiving details belong in the repository; never include keys or recovery phrases.

The model rejects malformed and duplicate entries. Payment destinations cannot be changed through URL parameters or browser storage. A donor explicitly selects a network before receiving details appear. A locally generated QR encodes the full Trust Wallet link, including the token/network asset ID. A late QR-generation result cannot replace the selected route. Copy/open actions do not claim a completed donation. Plivvi does not collect payment details, connect wallets, initiate transactions, or verify transfers.

## Visual and behavioral choices

A quiet footer link and optional invitation after a completed tool operation lead to the support page. There are no donation popups, countdowns, fabricated donor counts, preselected payment amounts, gifts, or feature restrictions. The panel explains the practical purpose: maintenance, device testing, and better tools. USDT gets a compact network view, while all supplied routes remain searchable.

A [large charitable checkout field experiment](https://www.nber.org/papers/w24327) found that short messages about a charity's mission could increase giving. Applying clear purpose and low-friction navigation to an open-source toolkit is a design inference, not a tested conversion or revenue forecast. [Research on thank-you gifts](https://pubmed.ncbi.nlm.nih.gov/28655844/) also gives reason to avoid assuming gifts always help.

The owner's asset links are the authority for these specific receiving routes. [Trust Wallet's receiving guide](https://trustwallet.com/blog/academy/how-to-receive-crypto-using-trust-wallet) describes obtaining receiving details; [Tether's supported protocols](https://tether.to/en/supported-protocols/) distinguish protocols and include legacy/deprecated networks. Do not imply every similarly named token is issuer-native. QR generation uses [node-qrcode](https://github.com/soldair/node-qrcode).

Checks cover route identity, URL encoding, network selection, and stale QR results. They do not prove ownership of a receiving address or execute a blockchain transfer.
