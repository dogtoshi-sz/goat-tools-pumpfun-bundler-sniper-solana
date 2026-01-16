# 🦊 Bonk.fun Multi-Wallet Bundle Trading Bot

A fast and reliable Solana bundle trading bot for **bonkfun** and **bonk.fun**-style token launches. This bot uses **Jito bundles** to create tokens and execute **multi-wallet buys in a single atomic block**. Built with **Raydium SDK v2**, it's designed for seamless one-block execution and fast inclusion.

## 🚀 Features

- ✅ Supports **dynamic multi-wallet bundling** (12+ wallets)
- ✅ Atomically creates tokens and buys from multiple wallets in **one block**
- ✅ **Dual bundle submission modes**: Standard Jito & Lil Jito
- ✅ Uses **Jito** relayer for secure and efficient bundle submission
- ✅ Executes trades via **Raydium SDK v2**
- ✅ Optimized for priority compute unit pricing

---

## 📸 Sample Bundles on Jito Explorer

These are just examples — the bot supports **any number of wallets**:

| Wallet Count | Jito Bundle                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| 12 Wallets   | [🔗 View](https://explorer.jito.wtf/bundle/dfec1729f72262df142ecd8b9a275fbe0addf35af743a99c5c0f1deb0fc0cf43) |

---

## ⚙️ How It Works

1. Creates a new token (like BONK)
2. Prepares swap transactions from multiple wallets
3. Wraps them into a **single atomic bundle** using Jito
4. Submits the bundle for inclusion in the same block

---

## 🎯 Bundle Submission Modes

The bot now supports **two bundle submission modes**:

### **Standard Jito Mode** (Default)

- Uses official Jito block-engine endpoints (NY, Tokyo)
- Industry-standard bundle submission
- Tested and reliable for mainnet execution

### **Lil Jito Mode** 🆕

- Alternative bundle submission endpoint
- Configurable via environment variables
- Includes bundle simulation and status tracking
- Easy toggle between modes via `LIL_JIT_MODE` flag

**Configuration:**

```bash
# Enable Lil Jito Mode
LIL_JIT_MODE=true
LIL_JIT_ENDPOINT=<your-lil-jit-endpoint>
LIL_JIT_WEBSOCKET_ENDPOINT=<your-lil-jit-ws-endpoint>

# Use Standard Jito Mode (default)
LIL_JIT_MODE=false
```

---

## 🛠 Tech Stack

- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Raydium SDK v2](https://github.com/raydium-io/raydium-sdk)
- [Jito-Solana](https://jito.network/)
- Custom bundler and transaction coordinator

---

## ⚡ Performance Tuning

Boost confirmation speed by adjusting compute unit pricing:

```ts
ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }); // High priority
```

Use higher values during congestion, or lower for savings.

---

## 🧪 Planned Features

- Auto-retry on bundle failure
- Live bundle result dashboard
- Strategy modules for flexible launch styles
- Telegram / Discord alerts

---

## 📬 Contact

For issues and questions, please open an issue on the repository.

---
