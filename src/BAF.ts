import { ScoreBoard } from 'mineflayer'
import { createBot } from 'mineflayer'
import { createFastWindowClicker } from './fastWindowClick'
import { addLoggerToClientWriteFunction, initLogger, log, printMcChatToConsole } from './logger'
import { clickWindow, sleep } from './utils'
import { onWebsocketCreateAuction } from './sellHandler'
import { tradePerson } from './tradeHandler'
import { swapProfile } from './swapProfileHandler'
import { flipHandler } from './flipHandler'
import { registerIngameMessageHandler } from './ingameMessageHandler'
import { MyBot, SellData, TextMessageData } from '../types/autobuy'
import { getConfigProperty, initConfigHelper, updatePersistentConfigProperty } from './configHelper'
import { getSessionId } from './coflSessionManager'
import { sendWebhookInitialized } from './webhookHandler'
import { setupConsoleInterface } from './consoleHandler'
import { initAFKHandler } from './AFKHandler'
const WebSocket = require('ws')
import axios from 'axios'
const crypto = require('crypto')
var prompt = require('prompt-sync')()
initConfigHelper()
initLogger()
const version = '1.5.0-af'
const wss: WebSocket[] = []
let ingameName = getConfigProperty('INGAME_NAME')

if (!ingameName) {
    ingameName = prompt('Enter your ingame name: ')
    updatePersistentConfigProperty('INGAME_NAME', ingameName)
}

const bot: MyBot = <any> createBot({
    username: ingameName,
    auth: 'microsoft',
    logErrors: true,
    version: '1.8.9',
    host: 'mc.hypixel.net'
})
bot.setMaxListeners(0)

bot.auctionEndedHandlers = {}
bot.registerAuctionEndedHandler = (handler, ...auctionIds: string[]) => {
    const id = crypto.randomBytes(20).toString('hex')
    bot.auctionEndedHandlers[id] = {
        ids: auctionIds,
        handler
    }
    return id
}
bot.unregisterAuctionEndedHandler = (id) => {
    if(bot.auctionEndedHandlers[id]) delete bot.auctionEndedHandlers[id]
}

bot.currentPingPromise = null
bot.ping = () => {
    if(bot.currentPingPromise !== null) return bot.currentPingPromise

    bot.currentPingPromise = new Promise(res => {
        const start = new Date().valueOf()
        bot._client.on('packet', (data, meta) => {
            if(meta.name === 'statistics') {
                res(new Date().valueOf() - start)
            }
        })

        bot._client.write('client_command', {
            payload: 1
        }) // Request statistics
    })
    bot.currentPingPromise.then(() => {
        bot.currentPingPromise = null
    })
    return bot.currentPingPromise
}

setInterval(async () => {
    try {
        const auctions = (await axios.get('https://api.hypixel.net/skyblock/auctions_ended')).data.auctions
        console.log(`Got ${auctions.length} ended auctions`)
        auctions.forEach(auction => {
            const aId = auction.auction_id
            Object.values(bot.auctionEndedHandlers).filter(o => o.ids.includes(aId)).forEach(o => {
                o.handler(auction)
            })
        })
    } catch (e) {
        console.log(e)
    }
}, 60 * 1000)

setInterval(async () => {
    try {
        const ping = await bot.ping()
        console.log(`Current ping is ${ping}ms`)
    } catch (e) {
        console.log(e)
    }
}, 30 * 1000)

bot.state = 'gracePeriod'
createFastWindowClicker(bot._client)

if (getConfigProperty('LOG_PACKAGES') === 'true') {
    addLoggerToClientWriteFunction(bot._client)
}

bot.once('login', connectWebsocket)
bot.once('spawn', async () => {
    await bot.waitForChunksToLoad()
    await sleep(2000)
    bot.chat('/play sb')
    bot.on('scoreboardTitleChanged', onScoreboardChanged)
    registerIngameMessageHandler(bot, {
        send: (text) => {
            wss.forEach(w => {
                w.send(text)
            })
        }
    })
})

const wss_count = 2
function connectWebsocket() {
    for(let i = 0; i < wss_count; i++) {
        wss.push(new WebSocket(`wss://sky.coflnet.com/modsocket?player=${ingameName}&version=${version}&SId=${getSessionId(ingameName, i)}`))
        const w = wss[i]
        w.onopen = function () {
            if(i === 0) setupConsoleInterface(w)
            sendWebhookInitialized()
        }
        w.onmessage = (msg) => onWebsocketMessage(msg, w, i)
        w.onclose = function (e) {
            log('Connection closed. Reconnecting... ', 'warn')
            setTimeout(function () {
                connectWebsocket()
            }, 1000)
        }
        w.onerror = function (err) {
            log('Connection error: ' + JSON.stringify(err), 'error')
            w.close()
        }
    }
}

async function onWebsocketMessage(msg, w: WebSocket, i: number) {
    let message = JSON.parse(msg.data)
    let data = JSON.parse(message.data)
    if (message.type !== 'chatMessage') {
        log(message, 'debug')
    }

    switch (message.type) {
        case 'flip':
            flipHandler(bot, data)
            break
        case 'chatMessage':
            if (getConfigProperty('USE_COFL_CHAT')) {
                for (let da of [...(data as TextMessageData[])]) {
                    printMcChatToConsole(da.text)
                }
            }
            break
        case 'writeToChat':
            printMcChatToConsole((data as TextMessageData).text)
            break
        case 'swapProfile':
            //swapProfile(bot, data)
            break
        case 'createAuction':
            onWebsocketCreateAuction(bot, data)
            break
        case 'trade':
            //tradePerson(bot, w, data)
            break
        case 'tradeResponse':
            let tradeDisplay = (bot.currentWindow.slots[39].nbt.value as any).display.value.Name.value
            if (tradeDisplay.includes('Deal!') || tradeDisplay.includes('Warning!')) {
                await sleep(3400)
            }
            clickWindow(bot, 39)
            break
        case 'getInventory':
            log('Uploading inventory...')
            w.send(
                JSON.stringify({
                    type: 'uploadInventory',
                    data: JSON.stringify(bot.inventory)
                })
            )
            break
        case 'execute':
            bot.chat(data)
            break
        case 'privacySettings':
            data.chatRegex = new RegExp(data.chatRegex)
            bot.privacySettings = data
            break
    }
}

async function onScoreboardChanged(scoreboard: ScoreBoard) {
    if (scoreboard.title.replace(/§[0-9a-fk-or]/gi, '').includes('SKYBLOCK')) {
        bot.removeListener('scoreboardTitleChanged', onScoreboardChanged)
        log('Joined SkyBlock')
        initAFKHandler(bot)
        setTimeout(() => {
            log('Waited for grace period to end. Flips can now be bought.')
            bot.state = null
            bot.removeAllListeners('scoreboardTitleChanged')
        }, 5500)
        await sleep(2500)
        bot.chat('/is')
    }
}
