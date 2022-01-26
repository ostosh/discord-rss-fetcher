import { LiteClient, LiteDisharmonyClient, loadConfig, Logger } from "disharmony"
import Feed from "../models/feed"
import Guild from "../models/guild"
import RssFetcher, { getRssFetcher } from "../service/rss-reader/abstract/rss-fetcher"
import ArticlePoster from "./article-poster"
import { delay } from "./../lib/common"
import { RssConfig } from "./../types/types"

export default class FeedMonitor
{
    public async beginMonitoring()
    {
        // See https://discord.js.org/#/docs/main/stable/typedef/Status
        while (this.client.djs.status !== 5)
            for (const djsGuild of this.client.djs.guilds.values())
            {
                const guild = new Guild(djsGuild)

                // Allow the event queue to clear before processing the next guild if no perms in this one
                if (!guild.hasPermissions(this.client.config.requiredPermissions))
                {
                    await new Promise((resolve) => setImmediate(resolve))
                    continue
                }

                await guild.loadDocument()
                const didPostNewArticle = await this.fetchAndProcessAllGuildFeeds(guild)

                if (didPostNewArticle)
                    await guild.save()

                // Sleep before next iteration
                let rssFeedTimeoutMs = 30000;
                if (this.client.config && (this.client.config as RssConfig).rssFeedTimeoutMs) {
                    rssFeedTimeoutMs = (this.client.config as RssConfig).rssFeedTimeoutMs
                }
                await delay(rssFeedTimeoutMs)
            }

        // Reaching this code means the above while loop exited, which means the bot disconnected
        await Logger.debugLogError(`Feed monitor disconnected from Discord!`)
        await Logger.logEvent("FeedMonitorDisconnect")
        process.exit(1)
    }

    public async fetchAndProcessAllGuildFeeds(guild: Guild)
    {
        let didPostNewArticle = false
        for (const feed of guild.feeds)
            didPostNewArticle = await this.fetchAndProcessFeed(guild, feed) || didPostNewArticle

        return didPostNewArticle
    }

    public async fetchAndProcessFeed(guild: Guild, feed: Feed): Promise<boolean>
    {
        let newArticleFound = false
        try {
            if (!guild.channels.has(feed.channelId))
                return false

            const articles = await this.rssFetcher.fetchArticles(feed.url)
            if (articles.length === 0)
                return false

            // Feed the new articles in chronological order
            for (var i = articles.length - 1 ; i >= 0; i --) {
                const link = articles[i].link
                if (!link || feed.isLinkInHistory(link))
                    continue

                newArticleFound = true
                feed.pushHistory(link)

                await this.articlePoster.postArticle(guild, feed.channelId, articles[i], feed.contentDisplayOption)
            }

            return newArticleFound
        }
        catch (e) {
            Logger.debugLogError(`Error fetching feed ${feed.url} in guild ${guild.name}`, e)
            return newArticleFound
        }
    }

    constructor(
        private client: LiteClient,
        private rssFetcher: RssFetcher,
        private articlePoster: ArticlePoster,
    )
    { }
}

if (!module.parent)
{
    const configPath = process.argv[2]
    const config = loadConfig(undefined, configPath)
    const client = new LiteDisharmonyClient(config)
    const articlePoster = new ArticlePoster()
    const feedMonitor = new FeedMonitor(client, getRssFetcher(), articlePoster)
    client.login(config.token)
        .then(() => feedMonitor.beginMonitoring())
        .catch(async err =>
        {
            await (Logger.debugLogError("Error initialising feed monitor", err) as Promise<void>)
            process.exit(1)
        })
}