
import {
  PublicKey,
  Keypair,
  Connection,
  VersionedTransaction
} from '@solana/web3.js';

const SLIPPAGE = 50

export const getBuyTxWithJupiter = async (wallet: Keypair, baseMint: PublicKey, amount: number) => {
  try {
    const quoteResponse = await (
      await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${baseMint.toBase58()}&amount=${amount}&slippageBps=${SLIPPAGE}`
      )
    ).json();

    // get serialized transactions for the swap
    const { swapTransaction } = await (
      await fetch("https://quote-api.jup.ag/v6/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey.toString(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 100000
        }),
      })
    ).json();

    // deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // sign the transaction
    transaction.sign([wallet]);
    return transaction
  } catch (error) {
    console.log("Failed to get buy transaction")
    return null
  }
};


export const getSellTxWithJupiter = async (wallet: Keypair, baseMint: PublicKey, amount: string) => {
  try {
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${baseMint.toBase58()}&outputMint=So11111111111111111111111111111111111111112&amount=${amount}&slippageBps=${SLIPPAGE}`
    console.log(`Fetching Jupiter quote: ${quoteUrl}`)
    
    const quoteResponse = await (await fetch(quoteUrl)).json();
    
    if (quoteResponse.error) {
      console.log("Jupiter quote error:", quoteResponse.error)
      return null
    }

    if (!quoteResponse || !quoteResponse.outAmount) {
      console.log("Jupiter: No quote available for this token")
      console.log("Response:", JSON.stringify(quoteResponse, null, 2))
      return null
    }

    console.log(`Jupiter quote: ${quoteResponse.outAmount} SOL for ${amount} tokens`)

    // get serialized transactions for the swap
    const swapResponse = await (
      await fetch("https://quote-api.jup.ag/v6/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey.toString(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 52000
        }),
      })
    ).json();

    if (swapResponse.error) {
      console.log("Jupiter swap error:", swapResponse.error)
      return null
    }

    if (!swapResponse.swapTransaction) {
      console.log("Jupiter: No swap transaction returned")
      console.log("Response:", JSON.stringify(swapResponse, null, 2))
      return null
    }

    // deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, "base64");
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // sign the transaction
    transaction.sign([wallet]);
    return transaction
  } catch (error: any) {
    console.log("Failed to get sell transaction from Jupiter:", error.message || error)
    return null
  }
};