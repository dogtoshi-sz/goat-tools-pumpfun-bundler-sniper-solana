# Setup Guide - Solana Token Bundler

## ✅ Security Audit Complete

The repository has been audited and is **SAFE** to use. One minor issue (unused secret key encoding) has been removed.

### What Was Checked:
- ✅ No drainer code found
- ✅ All fund transfers go to your wallet (not malicious addresses)
- ✅ Network calls only to legitimate services (Jito, Jupiter, IPFS)
- ✅ Dependencies are standard Solana libraries
- ✅ Removed suspicious dead code

---

## 📋 Prerequisites

1. **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
2. **SOL Balance** - You'll need sufficient SOL for:
   - Token creation fees
   - Distribution to bundler wallets
   - Jito tips
   - Transaction fees

3. **RPC Endpoints** - Get from:
   - [Helius](https://www.helius.dev/)
   - [QuickNode](https://www.quicknode.com/)
   - [Alchemy](https://www.alchemy.com/)

---

## 🚀 Quick Setup

### Step 1: Choose Your Platform

You have two options:
- **Pump.fun** (`pumpfun/` folder)
- **Bonk.fun** (`bonkfun/` folder)

### Step 2: Create Environment File

Navigate to your chosen folder and create a `.env` file:

**For Pump.fun:**
```bash
cd pumpfun
```

**For Bonk.fun:**
```bash
cd bonkfun
```

### Step 3: Configure `.env` File

Create a `.env` file in the chosen directory with these variables:

```env
# ============================================
# REQUIRED - Wallet & RPC Configuration
# ============================================
PRIVATE_KEY=your_private_key_in_base58_format
RPC_ENDPOINT=https://your-rpc-endpoint.com
RPC_WEBSOCKET_ENDPOINT=wss://your-websocket-endpoint.com

# ============================================
# Bundle Execution Mode
# ============================================
# Set to "false" for standard Jito (recommended)
# Set to "true" for Lil Jito (alternative)
LIL_JIT_MODE=false

# Only needed if LIL_JIT_MODE=true
LIL_JIT_ENDPOINT=https://your-lil-jit-endpoint
LIL_JIT_WEBSOCKET_ENDPOINT=wss://your-lil-jit-websocket

# ============================================
# Token Configuration
# ============================================
TOKEN_NAME=My Awesome Token
TOKEN_SYMBOL=MAT
TOKEN_SHOW_NAME=My Token Display Name
DESCRIPTION=This is my token description
TOKEN_CREATE_ON=pump.fun
TWITTER=https://twitter.com/yourhandle
TELEGRAM=https://t.me/yourchannel
WEBSITE=https://yourwebsite.com
FILE=./image/token_image.jpg

# ============================================
# Bundling Settings
# ============================================
SWAP_AMOUNT=0.1              # SOL per wallet
DISTRIBUTION_WALLETNUM=10     # Number of wallets to create
JITO_FEE=0.001               # Jito tip (in SOL)
VANITY_MODE=false            # Set to "true" to generate vanity address

# ============================================
# Optional - Single Wallet Mode
# ============================================
BUYER_WALLET=buyer_wallet_private_key_base58
BUYER_AMOUNT=0.5
```

### Step 4: Get Your Private Key in Base58 Format

If you have a Solana wallet, convert your private key to base58:

**Using Solana CLI:**
```bash
solana-keygen recover 'prompt://?full-path=/path/to/keypair.json' -o output.txt
```

**Or use an online tool** (be careful - only use trusted sources):
- Search for "base58 encode solana private key"

**⚠️ SECURITY WARNING:**
- Never share your private key
- Never commit `.env` to git
- Use a dedicated wallet (not your main wallet with large balances)
- Test with small amounts first

### Step 5: Prepare Token Image

1. Place your token image in the `image/` folder
2. Supported formats: JPG, PNG
3. Update the `FILE` path in `.env` (e.g., `./image/my_token.jpg`)

### Step 6: Calculate Required SOL

Use this formula:
```
Required SOL = (SWAP_AMOUNT + 0.01) × DISTRIBUTION_WALLETNUM + 0.04 + JITO_FEE
```

**Example:**
- SWAP_AMOUNT = 0.1 SOL
- DISTRIBUTION_WALLETNUM = 10
- JITO_FEE = 0.001 SOL

Calculation:
- `(0.1 + 0.01) × 10 = 1.1 SOL` (for purchases)
- `+ 0.04 SOL` (fees)
- `+ 0.001 SOL` (Jito tip)
- **Total: ~1.14 SOL minimum**

### Step 7: Run the Bundler

**Multi-wallet mode (recommended):**
```bash
npm start
```

**Single wallet mode:**
```bash
npm run single
```

---

## 📝 Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run main multi-wallet bundler |
| `npm run single` | Single wallet mode |
| `npm run gather` | Collect funds from generated wallets |
| `npm run close` | Close Address Lookup Table |
| `npm run status` | Check transaction status |

---

## 🔧 Configuration Tips

### RPC Endpoints

**Recommended Providers:**
- **Helius**: High performance, good for production
- **QuickNode**: Reliable, good rate limits
- **Alchemy**: Fast, enterprise-grade

**Free Options (not recommended for production):**
- Public Solana RPC (may have rate limits)

### Bundle Execution Modes

**Standard Jito (LIL_JIT_MODE=false):**
- ✅ Recommended for production
- ✅ Multiple regional endpoints (NY, Tokyo)
- ✅ Higher reliability
- Requires `JITO_FEE` to be set

**Lil Jito (LIL_JIT_MODE=true):**
- Alternative bundle service
- Simpler configuration
- Good for testing
- Requires `LIL_JIT_ENDPOINT` and `LIL_JIT_WEBSOCKET_ENDPOINT`

### Vanity Address Mode

Set `VANITY_MODE=true` to generate a token address with a custom suffix:
- Pump.fun: Addresses ending with "pump"
- Bonk.fun: Addresses ending with "bonk"

**Note:** This can take a long time (minutes to hours) depending on your hardware.

---

## 🚨 Troubleshooting

### "RPC endpoint failed"
- Use a premium RPC provider
- Check your API key is valid
- Verify network connectivity

### "Main wallet balance is not enough"
- Calculate required SOL using the formula above
- Add more SOL to your wallet
- Reduce `DISTRIBUTION_WALLETNUM` or `SWAP_AMOUNT`

### "Bundle submission failed"
- Increase `JITO_FEE` (try 0.002 or 0.005 SOL)
- Check network congestion
- Verify RPC endpoint is working
- Try reducing number of wallets

### "LUT creation failed"
- Wait 15-20 seconds after LUT creation before using it
- Retry the operation
- Check you have sufficient SOL for fees

---

## 🔐 Security Best Practices

1. **Never commit `.env` file** - It contains your private key!
2. **Use a dedicated wallet** - Don't use your main wallet
3. **Test with small amounts first** - Verify everything works
4. **Backup generated keys** - Wallets are saved in `keys/` folder
5. **Use trusted RPC providers** - Malicious RPCs could intercept transactions
6. **Keep `keys/` folder secure** - Contains private keys for generated wallets

---

## 📁 Project Structure

```
goat-tools-pumpfun-bundler-sniper-solana/
├── pumpfun/              # Pump.fun bundler
│   ├── .env             # Your config (create this)
│   ├── keys/            # Generated wallets (auto-created)
│   ├── image/           # Token images
│   └── index.ts         # Main entry point
├── bonkfun/             # Bonk.fun bundler
│   ├── .env             # Your config (create this)
│   ├── keys/            # Generated wallets (auto-created)
│   └── index.ts         # Main entry point
└── .gitignore           # Protects your private keys
```

---

## ✅ Next Steps

1. ✅ Dependencies installed
2. ✅ Security audit complete
3. ✅ Suspicious code removed
4. ⏭️ **Create `.env` file** with your configuration
5. ⏭️ **Add SOL** to your wallet
6. ⏭️ **Prepare token image**
7. ⏭️ **Test with small amounts first**
8. ⏭️ **Run `npm start`** when ready

---

## ⚠️ Important Notes

- **Always test with small amounts first**
- **This software is for educational purposes**
- **Use at your own risk**
- **The authors are not responsible for any financial losses**
- **Ensure compliance with local regulations**

---

## 🆘 Need Help?

1. Check the troubleshooting section above
2. Review logs for specific error messages
3. Verify all environment variables are set correctly
4. Ensure sufficient SOL balance
5. Test with a smaller number of wallets first

Good luck with your token launch! 🚀
