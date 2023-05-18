import { Flip, MyBot } from '../types/autobuy'
import { getConfigProperty } from './configHelper'
import { getFastWindowClicker } from './fastWindowClick'
import { log } from './logger'
import { sleep } from './utils'
import { sendWebhookData } from './webhookHandler'

export async function flipHandler(bot: MyBot, flip: Flip) {
    flip.purchaseAt = new Date(flip.purchaseAt)
    log('Flip: ' + JSON.stringify(flip))

    if (bot.state) {
        log('Currently busy with something else (' + bot.state + ') -> not buying flip')
        return
    }
    bot.state = 'purchasing'
    let timeout = setTimeout(() => {
        if (bot.state === 'purchasing') {
            log("Resetting 'bot.state === purchasing' lock")
            bot.state = null
        }
    }, 2500)

    let lastWindowId = getFastWindowClicker().getLastWindowId()
    let isBed = flip.purchaseAt.getTime() > new Date().getTime()

    let delayUntilBuyStart = isBed ? flip.purchaseAt.getTime() - new Date().getTime() : 0

    bot.lastViewAuctionCommandForPurchase = `/viewauction ${flip.id}`

    const viewAuctionCommandSentAt = new Date()
    const auctionEndedHandlerId = bot.registerAuctionEndedHandler((data) => {
        bot.unregisterAuctionEndedHandler(auctionEndedHandlerId)
        log(data)
        
        if(data.buyer === bot.player.uuid.replace('-', '')) {
            const endedTimestamp = data.timestamp
            const buyTime = endedTimestamp - viewAuctionCommandSentAt.valueOf()

            sendWebhookData({
                embeds: [
                    {
                        title: 'Time To Purchase',
                        fields: [
                            {
                                name: 'Item:',
                                value: `\`\`\`${flip.itemName}\`\`\``,
                                inline: true
                            },
                            {
                                name: 'Originally purchased around:',
                                value: `\`\`\`<t:${viewAuctionCommandSentAt}:T>\`\`\``,
                                inline: true
                            },
                            {
                                name: 'Bought in:',
                                value: `\`\`\`${buyTime}ms\`\`\``,
                                inline: true
                            }
                        ],
                        thumbnail: { url: `https://minotar.net/helm/${getConfigProperty('INGAME_NAME')}/600.png` }
                    }
                ]
            })
        }
    }, flip.id)

    bot.chat(bot.lastViewAuctionCommandForPurchase)
    await sleep(delayUntilBuyStart)
    if (isBed) {
        getFastWindowClicker().clickBedPurchase(flip.startingBid, lastWindowId + 1)
    } else {
        getFastWindowClicker().clickPurchase(flip.startingBid, lastWindowId + 1)
    }
    getFastWindowClicker().clickConfirm(flip.startingBid, flip.itemName, lastWindowId + 2)
    clearTimeout(timeout)
    bot.state = null
}
