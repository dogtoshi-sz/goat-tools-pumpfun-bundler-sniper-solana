import { Commitment, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import base58 from "bs58";
import axios from "axios";
import { JITO_FEE, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT } from "../constants";
import { rpc } from "@coral-xyz/anchor/dist/cjs/utils";
const solanaConnection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
})


export const executeJitoTx = async (transactions: VersionedTransaction[], payer: Keypair, commitment: Commitment, blockhash?: { blockhash: string; lastValidBlockHeight: number }) => {
  try {
    // Use provided blockhash if available (from token creation), otherwise get fresh one
    let latestBlockhash = blockhash || await solanaConnection.getLatestBlockhash();

    const jitoTxsignature = base58.encode(transactions[0].signatures[0]);

    // Serialize the transactions once here
    const serializedTransactions: string[] = [];
    for (let i = 0; i < transactions.length; i++) {
      const serializedTransaction = base58.encode(transactions[i].serialize());
      serializedTransactions.push(serializedTransaction);
    }

    // Use all available Jito endpoints for maximum success rate
    const endpoints = [
      'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
      'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
      'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
      'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
      'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
    ];

    // Retry function with exponential backoff for rate limiting
    const sendWithRetry = async (url: string, retries: number = 5, initialDelay: number = 1000): Promise<any> => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const response = await axios.post(url, {
            jsonrpc: '2.0',
            id: 1,
            method: 'sendBundle',
            params: [serializedTransactions],
          }, {
            timeout: 30000 // 30 second timeout
          });
          return response;
        } catch (error: any) {
          const isRateLimit = error.response?.status === 429;
          const isLastAttempt = attempt === retries - 1;
          
          if (isRateLimit && !isLastAttempt) {
            // Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s (capped at 20s)
            const baseDelay = initialDelay * Math.pow(2, attempt);
            const backoffDelay = Math.min(baseDelay, 20000); // Cap at 20 seconds
            const jitter = Math.random() * 500; // Add 0-0.5s random jitter
            const totalDelay = backoffDelay + jitter;
            
            await new Promise(resolve => setTimeout(resolve, totalDelay));
            continue;
          }
          
          // If it's the last attempt or not a rate limit, throw the error
          if (isLastAttempt) {
            throw error;
          }
        }
      }
    };

    console.log(`Sending bundle to ${endpoints.length} Jito endpoints with retry logic...`);

    // Send to all endpoints in parallel with retries
    const endpointPromises = endpoints.map((url, index) =>
      sendWithRetry(url, 5, 1000)
        .then((result) => ({ success: true, result, endpoint: index + 1, url }))
        .catch((error) => ({ success: false, error, endpoint: index + 1, url }))
    );

    // Wait for first success, then return immediately
    const results = await Promise.all(endpointPromises);
    const successfulResults = results.filter((r: any) => r.success);

    if (successfulResults.length > 0) {
      const firstSuccess = successfulResults[0] as any;
      const bundleId = firstSuccess.result?.data?.result;
      
      console.log(`✅ Bundle sent successfully to Jito (endpoint ${firstSuccess.endpoint})`)
      if (bundleId) {
        console.log(`   Bundle ID: ${bundleId}`)
        console.log(`   Check: https://jito.wtf/bundle/${bundleId}`)
      }
      console.log("   Transaction signature:", jitoTxsignature)
      console.log("   Wallets bought the token plz check keypairs in the data.json file in key folder")
      
      // Continue retries in background for other endpoints (non-blocking)
      Promise.all(endpointPromises).then(finalResults => {
        const allSuccessful = finalResults.filter((r: any) => r.success);
        if (allSuccessful.length > 1) {
          console.log(`   ✅ Bundle also accepted by ${allSuccessful.length - 1} other endpoint(s)`)
        }
      }).catch(() => {});
      
      // Try to confirm with timeout - don't block if it takes too long
      const confirmPromise = solanaConnection.confirmTransaction(
        {
          signature: jitoTxsignature,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          blockhash: latestBlockhash.blockhash,
        },
        commitment,
      ).catch(() => null);
      
      // Wait max 5 seconds for confirmation, then continue
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 5000));
      const confirmation = await Promise.race([confirmPromise, timeoutPromise]);
      
      if (confirmation && (confirmation as any).value && !(confirmation as any).value.err) {
        console.log("✅ Transaction confirmed")
      } else {
        console.log("⚠️  Confirmation pending - bundle was sent, check status manually")
      }
      
      return jitoTxsignature;
    } else {
      console.log(`❌ No successful responses from any Jito endpoint after retries`);
      return null;
    }
    return null
  } catch (error) {
    console.log('Error during transaction execution', error);
    return null
  }
}
