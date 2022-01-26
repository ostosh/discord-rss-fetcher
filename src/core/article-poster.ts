import { Guild as DjsGuild, TextChannel, MessageOptions } from "discord.js"
import { Logger } from "disharmony"
import * as HtmlToText from "html-to-text"
import Guild from "../models/guild"
import RssArticle from "../service/rss-reader/abstract/rss-article"

const articleTitleCharacterLimit = 100
const articleContentCharacterLimit = 250
const articleLinkCharacterLimit = 750
const articleFormattingShort = "\n{{article}}"
const articleFormattingLong = "\n{{article}}..."

export default class ArticlePoster
{
    public async postArticle(guild: Guild | DjsGuild, channelId: string, article: RssArticle, roleId: string)
    {
        const channel = guild.channels.get(channelId) as TextChannel
        const messageOptions = this.formatPost(article)

        try
        {
            await channel.send(messageOptions)
        }
        catch (e)
        {
            Logger.debugLogError(`Error posting article in channel ${channel.name} in guild ${channel.guild.name}`, e)
        }
    }

    private formatPost(article: RssArticle)
    {
        let title = article.title ? `\n**${article.title}**` : ""
        let link = article.link ? `\n${article.link}` : ""
        let articleStringTruncated = ""

        const titleTruncated = title.length <= articleTitleCharacterLimit ? title : title.substr(0, articleTitleCharacterLimit) + "..."
        const linkTruncated = link.length <= articleLinkCharacterLimit ? link : link.substr(0, articleLinkCharacterLimit)

        if (article.content)
        {
            let articleString = HtmlToText.fromString(article.content)
            const isTooLong = articleString.length > articleContentCharacterLimit

            articleString = isTooLong ? articleString.substr(0, articleContentCharacterLimit) : articleString

            articleStringTruncated =  (isTooLong ? articleFormattingLong : articleFormattingShort).replace("{{article}}", articleString)
        }

        const messageOptions: MessageOptions = {
            embed: {
                title: titleTruncated,
                description: articleStringTruncated, 
                color: 0xFFFFFF,
                url: linkTruncated,
            },
        }

        return messageOptions
    }
}