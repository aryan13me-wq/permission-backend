import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3000

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

app.get('/', (req, res) => {
  res.send('Backend is running ✅')
})

app.post('/next-nonce', async (req, res) => {
  try {
    const { user_wallet } = req.body

    const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL)
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      ['function nonces(address) view returns (uint256)'],
      provider
    )

    const nonce = await contract.nonces(user_wallet)

    res.json({ nonce: nonce.toString() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/save-signature', async (req, res) => {
  try {
    const { user_wallet, token, recipient, amount, deadline, nonce, signature } = req.body

    const { error } = await supabase.from('signatures').insert([{
      user_wallet,
      token,
      recipient,
      amount,
      deadline,
      nonce,
      signature,
      status: 'pending'
    }])

    if (error) return res.status(500).json({ error: error.message })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
