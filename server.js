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

app.get('/tokens', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tokens')
      .select('*')
      .order('symbol', { ascending: true })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/create-request', async (req, res) => {
  try {
    const {
      token_symbol,
      token_address,
      token_decimals,
      receiver,
      amount_display,
      amount_raw,
      expiry_seconds
    } = req.body

    const { data, error } = await supabase
      .from('requests')
      .insert([
        {
          token_symbol,
          token_address,
          token_decimals,
          receiver,
          amount_display,
          amount_raw,
          expiry_seconds,
          status: 'active'
        }
      ])
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ success: true, request: data })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/requests', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/request/:id', async (req, res) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/next-nonce', async (req, res) => {
  try {
    const { user_wallet } = req.body

    const { data, error } = await supabase
      .from('signatures')
      .select('nonce')
      .eq('user_wallet', user_wallet)
      .order('nonce', { ascending: false })
      .limit(1)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    const nonce = data && data.length > 0 ? Number(data[0].nonce) + 1 : 0

    return res.json({ nonce })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/save-signature', async (req, res) => {
  try {
    const {
      user_wallet,
      token,
      recipient,
      amount,
      deadline,
      nonce,
      signature
    } = req.body

    const { data, error } = await supabase
      .from('signatures')
      .insert([
        {
          user_wallet,
          token,
          recipient,
          amount,
          deadline,
          nonce,
          signature,
          status: 'pending'
        }
      ])
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ success: true, signature: data })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/signatures', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('signatures')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/execute-signature/:id', async (req, res) => {
  try {
    const { id } = req.params

    const { data: sig, error } = await supabase
      .from('signatures')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !sig) {
      return res.status(404).json({ error: 'Signature not found' })
    }

    if (sig.status === 'executed') {
      return res.json({
        success: true,
        message: 'Already executed',
        txHash: sig.tx_hash || null
      })
    }

    const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL)
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

    const abi = [
      'function executeTransfer(address user,address token,address to,uint256 amount,uint256 deadline,uint256 nonce,bytes signature)'
    ]

    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      abi,
      wallet
    )

    const tx = await contract.executeTransfer(
      sig.user_wallet,
      sig.token,
      sig.recipient,
      sig.amount,
      sig.deadline,
      sig.nonce,
      sig.signature
    )

    await tx.wait()

    await supabase
      .from('signatures')
      .update({
        status: 'executed',
        tx_hash: tx.hash
      })
      .eq('id', id)

    res.json({
      success: true,
      txHash: tx.hash
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
