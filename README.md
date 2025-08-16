

# Fogo-BOT

Automation bot for the **Fogo Testnet**, swapping between **FOGO** and **fUSD** in cycles.

## Setup

1. Install [Node.js](https://nodejs.org/) v16+
2. Clone and install:

```bash
git clone https://github.com/xerdrop/Fogo-BOT.git
cd Fogo-BOT
npm install
```

3. Create `.env`:

```env
PRIVATE_KEY_1=your_base58_private_key
```

(Optional) Add proxies in `proxies.txt` (one per line).

## Run

```bash
node main.js
```

The bot will load wallets, perform FOGO ⇆ fUSD swaps, and loop daily.

