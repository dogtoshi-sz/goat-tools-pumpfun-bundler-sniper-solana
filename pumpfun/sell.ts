import base58 from "bs58"
import { retrieveEnvVariable, sleep } from "./utils"
import { Connection, Keypair, PublicKey } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT, PRIVATE_KEY } from "./constants";
import { makeSellTx } from "./src/main";
import { execute } from "./executor/legacy";
import { getSellTxWithJupiter } from "./utils/swapOnlyAmm";

const connection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment: "confirmed"
})

const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))

const main = async () => {
  try {
    console.log(`\n=== Checking main wallet: ${mainKp.publicKey.toBase58()} ===`)
    
    // Allow mint address from command line argument or use mint.json
    let mintAddress: PublicKey
    const mintArg = process.argv[2]
    
    if (mintArg) {
      // Use mint address from command line argument
      mintAddress = new PublicKey(mintArg)
      console.log(`Using mint address from argument: ${mintAddress.toBase58()}`)
    } else {
      // Read mint address from mint.json
      const { readJson } = await import("./utils")
      const mintData = readJson("mint.json")
      if (!mintData || mintData.length === 0) {
        console.log("No mint.json found and no mint address provided.")
        console.log("Usage: npm run sell [MINT_ADDRESS]")
        console.log("Example: npm run sell AQu2rSYR3PL35QPDiZtSXcAspad9X7NDHwRMgXt2JSDt")
        return
      }
      
      const mintKp = Keypair.fromSecretKey(base58.decode(mintData[0]))
      mintAddress = mintKp.publicKey
      console.log(`Using mint address from mint.json: ${mintAddress.toBase58()}`)
    }
    
    console.log(`Token mint: ${mintAddress.toBase58()}`)
    
    // Check if main wallet has tokens
    const ata = getAssociatedTokenAddressSync(mintAddress, mainKp.publicKey)
    console.log(`Token account: ${ata.toBase58()}`)
    
    try {
      const tokenBalance = await connection.getTokenAccountBalance(ata, "confirmed")
      console.log(`Token balance: ${tokenBalance.value.uiAmount} tokens`)
      console.log(`Token amount (raw): ${tokenBalance.value.amount}`)
      
      if (!tokenBalance.value.uiAmount || tokenBalance.value.uiAmount === 0) {
        console.log("Main wallet has no tokens to sell.")
        return
      }
      
      // Check SOL balance for fees
      const solBalance = await connection.getBalance(mainKp.publicKey)
      console.log(`SOL balance: ${(solBalance / 10 ** 9).toFixed(4)} SOL`)
      
      if (solBalance < 0.01 * 10 ** 9) {
        console.log("ERROR: Insufficient SOL for transaction fees. Need at least 0.01 SOL.")
        return
      }
      
      // Sell tokens
      console.log(`\nSelling ${tokenBalance.value.uiAmount} tokens...`)
      
      let sellSuccess = false
      
      // Try pump.fun native sell first
      // Note: makeSellTx will automatically query the bonding curve to get the actual creator
      try {
        const sellTx = await makeSellTx(
          mainKp,
          BigInt(tokenBalance.value.amount),
          mintAddress,
          mainKp.publicKey // fallback creator/fee recipient (will be overridden if bonding curve has different creator)
        )
        
        if (sellTx) {
          console.log("Created pump.fun sell transaction")
          
          // Simulate first to check for errors and get more details
          try {
            const simResult = await connection.simulateTransaction(sellTx, { sigVerify: false })
            console.log("Simulation result:", JSON.stringify(simResult.value, null, 2))
            
            if (simResult.value.err) {
              console.log("❌ Transaction simulation failed!")
              console.log("Error:", simResult.value.err)
              if (simResult.value.logs) {
                console.log("Logs:")
                simResult.value.logs.forEach((log: string) => console.log("  ", log))
              }
              
              // Check if it's error 6000
              const errStr = JSON.stringify(simResult.value.err)
              if (errStr.includes("6000")) {
                console.log("\n⚠️ Error 6000 detected - This usually means:")
                console.log("  - Token may have migrated to Raydium")
                console.log("  - Sell may not be allowed on bonding curve")
                console.log("  - Token account may have restrictions")
                console.log("\nTrying Jupiter as fallback...")
                throw new Error("Pump.fun sell simulation failed with error 6000")
              }
              throw new Error(`Simulation failed: ${JSON.stringify(simResult.value.err)}`)
            }
            console.log("✅ Simulation successful, executing transaction...")
          } catch (simError: any) {
            if (!simError.message?.includes("6000")) {
              console.log("Simulation error:", simError.message || simError)
            }
            throw simError
          }
          
          const latestBlockhash = await connection.getLatestBlockhash()
          const txSig = await execute(sellTx, latestBlockhash, false)
          
          if (txSig) {
            console.log(`\n✅ Successfully sold tokens via pump.fun!`)
            console.log(`Transaction: https://solscan.io/tx/${txSig}`)
            sellSuccess = true
          }
        }
      } catch (error: any) {
        console.log("Pump.fun sell failed:", error.message || error)
        if (error.message?.includes("6000")) {
          console.log("Error 6000: Token may have migrated to Raydium or sell is not allowed")
        }
      }
      
      // If pump.fun sell failed, try Jupiter
      if (!sellSuccess) {
        try {
          console.log("\nTrying Jupiter DEX as fallback...")
          const jupiterSellTx = await getSellTxWithJupiter(mainKp, mintAddress, tokenBalance.value.amount)
          
          if (jupiterSellTx) {
            const latestBlockhash = await connection.getLatestBlockhash()
            const txSig = await execute(jupiterSellTx, latestBlockhash, false)
            
            if (txSig) {
              console.log(`\n✅ Successfully sold tokens via Jupiter!`)
              console.log(`Transaction: https://solscan.io/tx/${txSig}`)
              sellSuccess = true
            } else {
              console.log("Jupiter sell transaction failed to execute")
            }
          } else {
            console.log("Failed to create Jupiter sell transaction")
          }
        } catch (error: any) {
          console.log("Jupiter sell failed:", error.message || error)
        }
      }
      
      if (!sellSuccess) {
        console.log("\n❌ Failed to sell tokens via both pump.fun and Jupiter")
        console.log("The token may have migrated to Raydium or may not be tradeable yet")
        console.log("You may need to sell manually via:")
        console.log("  - pump.fun website")
        console.log("  - Raydium (if migrated)")
        console.log("  - Jupiter aggregator")
      }
      
    } catch (error: any) {
      if (error.message?.includes("Invalid param: could not find account")) {
        console.log("Token account does not exist. Main wallet has no tokens.")
      } else {
        console.log("Error checking token balance:", error)
      }
    }
    
  } catch (error) {
    console.log("Error:", error)
  }
}

main()
