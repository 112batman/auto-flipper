import { getConfigProperty, updatePersistentConfigProperty } from './configHelper'
import crypto from 'crypto'

const SESSIONS_KEY = 'SESSIONS'

export function getSessionId(username: string, i: number): string {
    let sessions = getConfigProperty(SESSIONS_KEY) as SESSIONS

    if (!sessions) {
        sessions = {}
        updatePersistentConfigProperty(SESSIONS_KEY, {})
    }

    const k = `${username}@${i}`
    if (!sessions[k]) {
        sessions[k] = {
            id: crypto.randomUUID(),
            expires: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 180)
        }
        updatePersistentConfigProperty(SESSIONS_KEY, sessions)
    }

    if (isExpired(sessions[k].expires)) {
        delete sessions[k]
        updatePersistentConfigProperty(SESSIONS_KEY, sessions)
        return null
    } else {
        return sessions[k].id
    }
}

export function isExpired(date: Date) {
    return date.getTime() < new Date().getTime()
}
