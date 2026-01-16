# Solana Token Bundler

A powerful tool for launching tokens on **pump.fun** and **bonk.fun** with coordinated multi-wallet purchases. This bundler creates your token and executes multiple buy transactions atomically in a single block using Jito bundles.

## What Does This Do?

The bundler automates the process of:
1. **Creating your token** on pump.fun or bonk.fun
2. **Generating multiple wallets** and distributing SOL to them
3. **Coordinating simultaneous purchases** from all wallets
4. **Executing everything in one atomic block** using Jito bundles

This ensures all your buy transactions happen together, preventing front-running and ensuring your token gets the initial liquidity boost you want.

## Quick Start

### 1. Install Dependencies

```bash
# Install for Pump.fun bundler
cd pumpfun
npm install

# Install for Bonk.fun bundler
cd ../Bonkfun
npm install
```

### 2. Configure Your Environment

Create a `.env` file in the bundler directory you want to use (`pumpfun/` or `Bonkfun/`):

```env
# Your wallet (base58 encoded private key)
PRIVATE_KEY=your_private_key_here

# Solana RPC endpoints (get from Helius, QuickNode, or Alchemy)
RPC_ENDPOINT=https://your-rpc-endpoint.com
RPC_WEBSOCKET_ENDPOINT=wss://your-websocket-endpoint.com

# Bundle execution mode (false = Jito, true = Lil Jito)
LIL_JIT_MODE=false

# Token details
TOKEN_NAME=My Awesome Token
TOKEN_SYMBOL=MAT
DESCRIPTION=This is my token description
TWITTER=https://twitter.com/yourhandle
TELEGRAM=https://t.me/yourchannel
WEBSITE=https://yourwebsite.com
FILE=./image/token_image.jpg

# Bundling settings
SWAP_AMOUNT=0.1              # SOL per wallet
DISTRIBUTION_WALLETNUM=10    # Number of wallets to use
JITO_FEE=0.001              # Jito tip (in SOL)
```

### 3. Run the Bundler

```bash
# Navigate to your chosen bundler
cd pumpfun  # or cd Bonkfun

# Start the bundler
npm start
```

That's it! The bundler will:
- Create your token
- Generate wallets
- Distribute SOL
- Execute all buys in one atomic bundle

## Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run the main multi-wallet bundler |
| `npm run single` | Use single wallet mode (simpler, but less effective) |
| `npm run gather` | Collect funds back from generated wallets |
| `npm run close` | Close the Address Lookup Table (cleanup) |
| `npm run status` | Check transaction status |

## How It Works

### The Bundling Process

1. **Token Creation**: Your token is created on the platform (pump.fun or bonk.fun)
2. **Wallet Generation**: The bundler creates multiple new wallets
3. **SOL Distribution**: SOL is sent from your main wallet to each generated wallet
4. **LUT Creation**: An Address Lookup Table is created to optimize transaction size
5. **Bundle Assembly**: All buy transactions are prepared and signed
6. **Atomic Execution**: Everything is submitted as a Jito bundle, executing in one block

### Why Use Bundles?

- **Atomic Execution**: All transactions either succeed together or fail together
- **No Front-Running**: Transactions execute in the exact order you specify
- **Better Price**: All buys happen at the same price point on the bonding curve
- **MEV Protection**: Jito bundles protect against MEV bots

## Configuration Explained

### Required Settings

- **PRIVATE_KEY**: Your main wallet's private key in base58 format
- **RPC_ENDPOINT**: Your Solana RPC endpoint (use premium providers for best results)
- **RPC_WEBSOCKET_ENDPOINT**: WebSocket endpoint for real-time updates

### Token Settings

- **TOKEN_NAME**: The name of your token
- **TOKEN_SYMBOL**: Short symbol (3-5 characters)
- **DESCRIPTION**: Token description
- **FILE**: Path to your token image (JPG or PNG)
- **TWITTER/TELEGRAM/WEBSITE**: Your social links

### Bundling Settings

- **SWAP_AMOUNT**: How much SOL each wallet will use to buy (e.g., 0.1 SOL)
- **DISTRIBUTION_WALLETNUM**: How many wallets to create (more = bigger initial buy)
- **JITO_FEE**: Tip paid to Jito validators (0.001 SOL is usually enough)

### Calculating Required SOL

You'll need enough SOL in your main wallet:

```
Required SOL = (SWAP_AMOUNT + 0.01) × DISTRIBUTION_WALLETNUM + 0.04 + JITO_FEE
```

**Example**: With 10 wallets buying 0.1 SOL each:
- `(0.1 + 0.01) × 10 = 1.1 SOL` for purchases
- `+ 0.04 SOL` for fees
- `+ 0.001 SOL` for Jito tip
- **Total: ~1.14 SOL minimum**

## Bundle Execution Modes

### Standard Jito Mode (Recommended)

- **Set**: `LIL_JIT_MODE=false`
- **How it works**: Submits bundles to official Jito endpoints (NY and Tokyo)
- **Best for**: Production use, maximum reliability
- **Requires**: `JITO_FEE` to be set

### Lil Jito Mode

- **Set**: `LIL_JIT_MODE=true`
- **How it works**: Uses alternative bundle submission endpoint
- **Best for**: Testing or when Jito is congested
- **Requires**: `LIL_JIT_ENDPOINT` and `LIL_JIT_WEBSOCKET_ENDPOINT` to be set

**Recommendation**: Start with Standard Jito mode unless you have a specific reason to use Lil Jito.

## Troubleshooting

### "RPC endpoint failed"

**Solution**: 
- Use a premium RPC provider (Helius, QuickNode, or Alchemy)
- Check your API key is valid
- Verify network connectivity

### "Main wallet balance is not enough"

**Solution**:
- Calculate required SOL using the formula above
- Add more SOL to your wallet
- Reduce `DISTRIBUTION_WALLETNUM` or `SWAP_AMOUNT`

### "Bundle submission failed"

**Solution**:
- Increase `JITO_FEE` (try 0.002 or 0.005 SOL)
- Check network congestion
- Verify your RPC endpoint is working
- Try reducing the number of wallets

### "LUT creation failed"

**Solution**:
- Wait 15-20 seconds after LUT creation before using it
- Retry the operation
- Check you have sufficient SOL for fees

## Security Best Practices

⚠️ **IMPORTANT**: 

- **Never commit your `.env` file** - it contains your private key!
- **Never share your private key** with anyone
- **Test with small amounts first** before using real funds
- **Use a dedicated wallet** - don't use your main wallet with large balances
- **Backup your generated keys** - wallets are created in the `keys/` folder
- **Use trusted RPC providers** - malicious RPCs could intercept your transactions

## Project Structure

```
goat-tools-pumpfun-bundler/
├── pumpfun/          # Pump.fun bundler
│   ├── .env         # Your configuration (create this)
│   ├── keys/        # Generated wallets (auto-created)
│   └── index.ts     # Main entry point
└── Bonkfun/         # Bonk.fun bundler
    ├── .env         # Your configuration (create this)
    ├── keys/        # Generated wallets (auto-created)
    └── index.ts     # Main entry point
```

## What Gets Generated

When you run the bundler, it creates:

- **Token**: Your new token on pump.fun or bonk.fun
- **Wallets**: Multiple wallets in the `keys/` folder
- **LUT**: Address Lookup Table for transaction optimization
- **Logs**: Transaction signatures and status information

**Important**: The `keys/` folder contains private keys for all generated wallets. Keep this secure and never commit it to git!

## Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs for specific error messages
3. Verify all environment variables are set correctly
4. Ensure you have sufficient SOL balance
5. Test with a smaller number of wallets first

## Requirements

- **Node.js**: v16 or higher
- **SOL Balance**: Enough for token creation + wallet distribution + fees
- **RPC Endpoint**: Premium provider recommended (Helius, QuickNode, Alchemy)

## License

ISC License

---

**⚠️ Disclaimer**: This software is for educational purposes. Use at your own risk. Always test with small amounts first. The authors are not responsible for any financial losses.
