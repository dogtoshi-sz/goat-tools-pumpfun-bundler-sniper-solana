import base58 from "bs58"
import { readJson, retrieveEnvVariable, sleep } from "./utils"
import { ComputeBudgetProgram, Connection, Keypair, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction, sendAndConfirmTransaction } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createCloseAccountInstruction, createTransferCheckedInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SPL_ACCOUNT_LAYOUT, TokenAccount } from "@raydium-io/raydium-sdk";
import { getSellTxWithJupiter } from "./utils/swapOnlyAmm";
import { execute } from "./executor/legacy";
import { BUYER_WALLET, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT, PRIVATE_KEY } from "./constants";
import { makeSellTx } from "./src/main";

export const solanaConnection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment: "processed"
})

const rpcUrl = retrieveEnvVariable("RPC_ENDPOINT");
const mainKpStr = retrieveEnvVariable('PRIVATE_KEY');
const connection = new Connection(rpcUrl, { commitment: "processed" });
const mainKp = Keypair.fromSecretKey(base58.decode(mainKpStr))

const main = async () => {
  // Read wallets from data.json
  const walletsData = readJson()
  let wallets = walletsData.map((kp) => Keypair.fromSecretKey(base58.decode(kp)))
  
  // Also check the mint address to find wallets that actually hold tokens
  try {
    const mintData = readJson("mint.json")
    if (mintData && mintData.length > 0) {
      const mintKp = Keypair.fromSecretKey(base58.decode(mintData[0]))
      const mintAddress = mintKp.publicKey
      console.log(`\nMint address: ${mintAddress.toBase58()}`)
      console.log(`Checking wallets from data.json and also searching for token holders...`)
    }
  } catch (error) {
    console.log("Could not read mint.json")
  }
  
  if (BUYER_WALLET) {
    wallets.push(Keypair.fromSecretKey(base58.decode(BUYER_WALLET)))
  }
  
  console.log(`\nTotal wallets to check: ${wallets.length}`)

  // Process all wallets in parallel for maximum speed
  await Promise.all(wallets.map(async (kp, i) => {
    try {
      console.log(`\n=== Processing wallet ${i + 1}/${wallets.length}: ${kp.publicKey.toBase58()} ===`)
      
      const accountInfo = await connection.getAccountInfo(kp.publicKey, "processed")
      const solBal = await connection.getBalance(kp.publicKey, "processed")
      console.log(`SOL balance: ${(solBal / 10 ** 9).toFixed(4)} SOL`)

      const tokenAccounts = await connection.getTokenAccountsByOwner(kp.publicKey, {
        programId: TOKEN_PROGRAM_ID,
      },
        "processed" // Use processed for faster queries
      )
      const ixs: TransactionInstruction[] = []
      const accounts: TokenAccount[] = [];

      // Process all token accounts - track empty ones for closing too
      const emptyTokenAccounts: { pubkey: any }[] = []
      
      if (tokenAccounts.value.length > 0) {
        console.log(`Found ${tokenAccounts.value.length} token account(s)`)
        for (const { pubkey, account } of tokenAccounts.value) {
          const tokenData = SPL_ACCOUNT_LAYOUT.decode(account.data)
          // Add accounts with non-zero balance for processing
          // tokenData.amount is a BN, so we check if it's not zero
          const tokenAmount = tokenData.amount.toString()
          if (tokenAmount !== "0") {
            accounts.push({
              pubkey,
              programId: account.owner,
              accountInfo: tokenData,
            });
            console.log(`  Token: ${tokenData.mint.toBase58()}, Amount: ${tokenData.amount.toString()}`)
          } else {
            // Track empty accounts to close them later (to recover rent)
            emptyTokenAccounts.push({ pubkey })
            console.log(`  Token: ${tokenData.mint.toBase58()}, Amount: 0 (will close to recover rent)`)
          }
        }
      } else {
        console.log("No token accounts found")
      }

      // Early skip: Only skip if wallet is completely empty (no tokens, no empty token accounts, and less than rent-exempt minimum)
      // Don't skip wallets with SOL - let the SOL gathering logic at the end handle them
      const rentExemptMin = 0.00089 * 10 ** 9 // Rent exempt minimum
      
      // Only skip if: no tokens with balance, no empty token accounts, AND less than rent-exempt minimum (truly empty)
      // Wallets with SOL (even small amounts) should be processed to gather that SOL
      if (accounts.length === 0 && emptyTokenAccounts.length === 0 && solBal < rentExemptMin) {
        console.log(`⏭️  Skipping wallet: Completely empty (no tokens, no empty token accounts, ${(solBal / 10 ** 9).toFixed(4)} SOL < rent-exempt minimum)`)
        return
      }

      // Check if wallet has tokens but insufficient SOL for fees
      const minSolForFees = 0.02 * 10 ** 9 // 0.02 SOL for transaction fees
      
      if (accounts.length > 0 && solBal < minSolForFees) {
        console.log(`Wallet has tokens but insufficient SOL (${(solBal / 10 ** 9).toFixed(4)} SOL). Sending 0.02 SOL for fees...`)
        const fundTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: mainKp.publicKey,
            toPubkey: kp.publicKey,
            lamports: minSolForFees
          })
        )
        fundTx.feePayer = mainKp.publicKey
        fundTx.recentBlockhash = (await connection.getLatestBlockhash("processed")).blockhash
        const fundSig = await sendAndConfirmTransaction(connection, fundTx, [mainKp], { 
          commitment: "processed",
          skipPreflight: true // Skip preflight for speed
        })
        console.log(`Funded wallet. Transaction: https://solscan.io/tx/${fundSig}`)
        // No sleep needed - transaction is confirmed, balance will update on next query
      }

      // Process tokens: sell them first, then transfer remaining balance and close accounts
      const tokenAccountsToClose: { pubkey: any, mint: any }[] = []
      
      for (let j = 0; j < accounts.length; j++) {
        const baseAta = await getAssociatedTokenAddress(accounts[j].accountInfo.mint, mainKp.publicKey)
        const tokenAccount = accounts[j].pubkey
        const tokenBalance = (await connection.getTokenAccountBalance(accounts[j].pubkey)).value

        let retryCount = 0
        while (true) {
          if (retryCount > 10) {
            console.log("Sell error before gather")
            break
          }
          if (tokenBalance.uiAmount == 0 || tokenBalance.amount === "0") {
            console.log("Token balance is 0")
            break
          }
          try {
            console.log("Selling token:", accounts[j].accountInfo.mint.toBase58())
            // Try pump.fun native sell first
            const sellTx = await makeSellTx(kp, BigInt(tokenBalance.amount), accounts[j].accountInfo.mint, mainKp.publicKey)
            if (sellTx) {
              const latestBlockhashForSell = await solanaConnection.getLatestBlockhash("processed")
              const txSellSig = await execute(sellTx, latestBlockhashForSell, false)
              const tokenSellTx = txSellSig ? `https://solscan.io/tx/${txSellSig}` : ''
              console.log("Sold token via pump.fun, ", tokenSellTx)
              break
            } else {
              // Fallback to Jupiter if pump.fun sell fails
              const jupiterSellTx = await getSellTxWithJupiter(kp, accounts[j].accountInfo.mint, tokenBalance.amount)
              if (jupiterSellTx == null) {
                throw new Error("Error getting sell tx")
              }
              const latestBlockhashForSell = await solanaConnection.getLatestBlockhash("processed")
              const txSellSig = await execute(jupiterSellTx, latestBlockhashForSell, false)
              const tokenSellTx = txSellSig ? `https://solscan.io/tx/${txSellSig}` : ''
              console.log("Sold token via Jupiter, ", tokenSellTx)
              break
            }
          } catch (error) {
            console.log("Sell attempt failed:", error)
            retryCount++
            await sleep(100) // Small delay only on retry
          }
        }
        // Check balance after sell - wait a moment for balance to update
        await sleep(1000) // Give time for sell transaction to settle
        const tokenBalanceAfterSell = (await connection.getTokenAccountBalance(accounts[j].pubkey, "processed")).value
        console.log("Wallet address & balance : ", kp.publicKey.toBase58(), tokenBalanceAfterSell.amount)
        
        // Only process if there's still a balance (sell might not have been 100% successful)
        if (tokenBalanceAfterSell.uiAmount && tokenBalanceAfterSell.uiAmount > 0) {
          // Check if ATA exists before adding instruction
          const ataInfo = await connection.getAccountInfo(baseAta, "processed")
          if (!ataInfo) {
            ixs.push(createAssociatedTokenAccountIdempotentInstruction(mainKp.publicKey, baseAta, mainKp.publicKey, accounts[j].accountInfo.mint))
          }
          ixs.push(createTransferCheckedInstruction(tokenAccount, accounts[j].accountInfo.mint, baseAta, kp.publicKey, BigInt(tokenBalanceAfterSell.amount), tokenBalance.decimals))
        }
        
        // Track token accounts to close (even if empty, closing returns rent)
        tokenAccountsToClose.push({ pubkey: tokenAccount, mint: accounts[j].accountInfo.mint })
      }

      // Handle wallets with token accounts (close accounts and gather)
      if (tokenAccountsToClose.length > 0 || emptyTokenAccounts.length > 0 || ixs.length > 0) {
        // Add close account instructions for all token accounts (both with balance and empty)
        for (const { pubkey } of tokenAccountsToClose) {
          ixs.push(createCloseAccountInstruction(pubkey, mainKp.publicKey, kp.publicKey))
        }
        // Also close empty token accounts to recover rent
        for (const { pubkey } of emptyTokenAccounts) {
          ixs.push(createCloseAccountInstruction(pubkey, mainKp.publicKey, kp.publicKey))
        }

        // Check SOL balance after sell - wallet should have received SOL from the sale
        // Need enough SOL for: transaction fees + potential ATA creation rent (~0.002 SOL) + closing accounts
        const solBalBeforeClose = await connection.getBalance(kp.publicKey, "processed")
        // Calculate minimum needed: transaction fee + rent for each account being closed/created
        const estimatedFee = 0.000005 * 10 ** 9 // Base transaction fee
        const rentPerAccount = 0.000002 * 10 ** 9 // Rent per account (approximate)
        const totalAccountsToClose = tokenAccountsToClose.length + emptyTokenAccounts.length
        // Estimate: each ATA creation needs rent, and we might create up to accounts.length ATAs
        const estimatedATACreations = accounts.length
        const minSolForClose = estimatedFee + (rentPerAccount * Math.max(1, totalAccountsToClose + estimatedATACreations))
        
        // Ensure we have at least 0.01 SOL for safety
        const safeMinSol = Math.max(0.01 * 10 ** 9, minSolForClose)
        
        if (solBalBeforeClose < safeMinSol) {
          console.log(`Wallet has insufficient SOL (${(solBalBeforeClose / 10 ** 9).toFixed(4)} SOL) for closing accounts. Funding with ${(safeMinSol / 10 ** 9).toFixed(4)} SOL...`)
          const fundTx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: mainKp.publicKey,
              toPubkey: kp.publicKey,
              lamports: safeMinSol
            })
          )
          fundTx.feePayer = mainKp.publicKey
          fundTx.recentBlockhash = (await connection.getLatestBlockhash("processed")).blockhash
          try {
            const fundSig = await sendAndConfirmTransaction(connection, fundTx, [mainKp], { 
              commitment: "processed",
              skipPreflight: true
            })
            console.log(`Funded wallet for account closure. Transaction: https://solscan.io/tx/${fundSig}`)
            // Wait a moment for balance to update
            await sleep(1000)
          } catch (error: any) {
            console.log(`Failed to fund wallet: ${error.message || error}`)
            // If funding fails, we can't proceed with closing accounts
            return
          }
        }

        // Get updated balance after potential funding
        const solBalAfterFunding = await connection.getBalance(kp.publicKey, "processed")
        
        // Gather remaining SOL after closing accounts (but leave rent-exempt minimum + transaction fee)
        const rentExempt = 0.00089 * 10 ** 9 // Minimum rent-exempt balance
        const txFeeBuffer = 0.00001 * 10 ** 9 // Transaction fee buffer
        const minToKeep = rentExempt + txFeeBuffer
        const solToGather = solBalAfterFunding > minToKeep ? solBalAfterFunding - minToKeep : 0
        
        if (solToGather > 0) {
          ixs.push(
            SystemProgram.transfer({
              fromPubkey: kp.publicKey,
              toPubkey: mainKp.publicKey,
              lamports: solToGather
            })
          )
        }

        if (ixs.length > 0) {
          const tx = new Transaction().add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 220_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
            ...ixs,
          )
          tx.feePayer = mainKp.publicKey
          tx.recentBlockhash = (await connection.getLatestBlockhash("processed")).blockhash
          
          try {
            const sig = await sendAndConfirmTransaction(connection, tx, [mainKp, kp], { 
              commitment: "processed",
              skipPreflight: true
            })
            console.log(`Closed and gathered SOL from wallet ${i + 1} : https://solscan.io/tx/${sig}`)
          } catch (error: any) {
            // Better error handling
            if (error.message?.includes("InsufficientFundsForRent") || 
                error.transactionMessage?.includes("InsufficientFundsForRent")) {
              console.log(`Wallet ${i + 1} has insufficient funds for rent. Balance: ${(solBalAfterFunding / 10 ** 9).toFixed(4)} SOL. Skipping.`)
            } else {
              console.log(`Error closing accounts and gathering from wallet ${i + 1}:`, error.message || error)
            }
          }
        }
        return
      }

      // Handle wallets with no token accounts (just gather SOL)
      // Re-check balance in case it changed during token processing
      const finalSolBal = await connection.getBalance(kp.publicKey, "processed")
      
      // Leave enough for rent-exempt minimum + transaction fee + buffer
      const rentExempt = 0.00089 * 10 ** 9 // Minimum rent-exempt balance
      const txFeeForGather = 0.00001 * 10 ** 9 // Transaction fee buffer
      const safetyBuffer = 0.0001 * 10 ** 9 // Extra safety buffer
      const minToKeep = rentExempt + txFeeForGather + safetyBuffer
      const minToGather = 0.0001 * 10 ** 9 // Minimum amount worth gathering (0.0001 SOL)
      const solToGather = finalSolBal > minToKeep ? finalSolBal - minToKeep : 0
      
      // Only gather if amount is worth it (more than 0.0001 SOL)
      if (solToGather > minToGather) {
        const gatherTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: kp.publicKey,
            toPubkey: mainKp.publicKey,
            lamports: solToGather
          })
        )
        gatherTx.feePayer = mainKp.publicKey
        gatherTx.recentBlockhash = (await connection.getLatestBlockhash("processed")).blockhash
        
        try {
          const sig = await sendAndConfirmTransaction(connection, gatherTx, [mainKp, kp], { 
            commitment: "processed",
            skipPreflight: true
          })
          console.log(`✅ Gathered ${(solToGather / 10 ** 9).toFixed(4)} SOL from wallet ${i + 1}: https://solscan.io/tx/${sig}`)
        } catch (error: any) {
          // If gathering fails due to rent, skip it
          if (error.message?.includes("InsufficientFundsForRent") || 
              error.transactionMessage?.includes("InsufficientFundsForRent")) {
            console.log(`⚠️  Wallet ${i + 1} needs more SOL for rent exemption. Skipping gather. (Balance: ${(finalSolBal / 10 ** 9).toFixed(4)} SOL)`)
          } else {
            console.log(`❌ Error gathering from wallet ${i + 1}:`, error.message || error)
          }
        }
      } else {
        console.log(`⏭️  Wallet ${i + 1} has insufficient SOL (${(finalSolBal / 10 ** 9).toFixed(4)} SOL) to gather safely.`)
      }
    } catch (error) {
      console.log("transaction error while gathering", error)
      return
    }
  }))
  
  console.log("\n✅ All wallets processed!")
}

main()
