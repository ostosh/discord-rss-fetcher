import { TextChannel } from "discord.js"
import { NotifyPropertyChanged, SubDocument } from "disharmony"
import Normalise from "../core/normaliser"
import Guild from "./guild"

export default class Feed extends SubDocument implements NotifyPropertyChanged
{
    private maxHistoryCount = 20000 // TODO replace this with db on disk or hash based cache with proper eviction
    private history: string[] = []

    public id: string
    public url: string
    public channelId: string
    public roleId: string
    public contentDisplayOption: string

    public isLinkInHistory(link: string): boolean
    {
        return this.history.indexOf(Normalise.forCache(link)) > -1
    }

    public pushHistory(...links: string[])
    {
        const newLinks = links.map(x => Normalise.forCache(x)).filter(x => !this.isLinkInHistory(x))
        Array.prototype.push.apply(this.history, newLinks)
        // Keep the latest feeds
        if (this.history.length > this.maxHistoryCount) {
            this.history = this.history.slice(-this.maxHistoryCount)  
        }
        this.onPropertyChanged.dispatch("history")
    }

    public toRecord()
    {
        return {
            id: this.id,
            url: this.url,
            channelId: this.channelId,
            roleId: this.roleId,
            history: this.history,
            contentDisplayOption: this.contentDisplayOption
        }
    }

    public loadRecord(record: any)
    {
        this.id = record.id
        this.url = record.url
        this.channelId = record.channelId
        this.roleId = record.roleId
        this.history = record.history
        this.contentDisplayOption = record.contentDisplayOption
    }

    public toFriendlyObject(guild: Guild)
    {
        const channel = guild.channels.get(this.channelId)
        const channelName = channel instanceof TextChannel ? channel.name : "<<unavailable>>"
        const role = guild.djs.roles.get(this.roleId)
        const roleName = role ? role.name : "<<N/A>>"
        return {
            id: this.id,
            url: this.url,
            channel: channelName,
            role: roleName,
            contentDisplayOption: this.contentDisplayOption
        }
    }

    public static create(id: string, url: string, channelId: string, roleId?: string, contentDisplayOption?: string): Feed
    {
        const feed = new Feed()
        feed.id = id
        feed.url = url
        feed.channelId = channelId

        if (roleId)
            feed.roleId = roleId

        if (contentDisplayOption)
            feed.contentDisplayOption = contentDisplayOption

        return feed
    }
}