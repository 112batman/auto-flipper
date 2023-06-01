import { Flip, MyBot } from '../types/autobuy'
import { getConfigProperty } from './configHelper'
import { getFastWindowClicker } from './fastWindowClick'
import { log, printMcChatToConsole } from './logger'
import { numberWithThousandsSeparators, sleep } from './utils'
import { sendWebhookData } from './webhookHandler'

export async function flipHandler(bot: MyBot, flip: Flip) {
    flip.purchaseAt = new Date(flip.purchaseAt)

    if (bot.state) {
        setTimeout(() => {
            flipHandler(bot, flip)
        }, 1100)
        return
    }
    bot.state = 'purchasing'
    let timeout = setTimeout(() => {
        if (bot.state === 'purchasing') {
            log("Resetting 'bot.state === purchasing' lock")
            bot.state = null
        }
    }, 2500)
    let isBed = flip.purchaseAt.getTime() > new Date().getTime()

    printMcChatToConsole(
        `§f[§4BAF§f]: §fTrying to purchase flip${isBed ? ' (Bed)' : ''}: ${flip.itemName} §for ${numberWithThousandsSeparators(
            flip.startingBid
        )} coins (Target: ${numberWithThousandsSeparators(flip.target)})`
    )

    let lastWindowId = getFastWindowClicker().getLastWindowId()

    let delayUntilBuyStart = isBed ? flip.purchaseAt.getTime() - new Date().getTime() : getConfigProperty('FLIP_ACTION_DELAY')

    bot.lastViewAuctionCommandForPurchase = `/viewauction ${flip.id}`

    const viewAuctionCommandSentAt = new Date()
    const auctionEndedHandlerId = bot.registerAuctionEndedHandler((data) => {
        bot.unregisterAuctionEndedHandler(auctionEndedHandlerId)
        //console.log(data)

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
    await sleep(getConfigProperty('FLIP_ACTION_DELAY'))
    getFastWindowClicker().clickConfirm(flip.startingBid, flip.itemName, lastWindowId + 2)
    clearTimeout(timeout)

    // clear timeout after 1sec, so there are no weird overlaps that mess up the windowIds
    setTimeout(() => {
        bot.state = null
    }, 2000)
}
