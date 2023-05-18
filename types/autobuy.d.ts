import { Bot } from 'mineflayer'

interface SellData {
    price: number
    slot: number
    duration: number
    itemName: string
    id: string
}

interface TradeData {
    target: string
    slots: number[]
    coins: number
}

interface SwapData {
    profile: string
}

interface Flip {
    id: string
    startingBid: number
    purchaseAt: Date
    itemName: string
}

interface TextMessageData {
    text: string
}

interface MyBot extends Bot {
    state?: 'purchasing' | 'selling' | 'claiming' | 'gracePeriod'
    lastViewAuctionCommandForPurchase?: string
    privacySettings?: any
    auctionEndedHandlers: {
        [key: string]: {
            ids: string[],
            handler: (id: string) => void
        }
    },
    registerAuctionEndedHandler: (handler: (data: any) => void, ...auctionIds: string[]) => string,
    unregisterAuctionEndedHandler: (id: string) => void,
    currentPingPromise: Promise<number> | null,
    ping: () => Promise<number> 
}
