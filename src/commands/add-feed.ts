import { Client, Command, CommandRejection, DisharmonyMessage, PermissionLevel, Question } from "disharmony"
import * as ShortId from "shortid"
import * as Url from "url"
import Feed from "../models/feed"
import Message from "../models/message"
import { getRssFetcher } from "../service/rss-reader/abstract/rss-fetcher"

async function invoke(params: string[], message: Message, client: Client)
{
    // Validate and retrieve channel ID
    if (message.mentions.channels.size === 0)
        throw new CommandRejection("Invalid channel")
    const channelId = message.mentions.channels.first().id

    // Validate and retrieve feed URL
    const url = params[0]
    if (!isValid(url))
        throw new CommandRejection("Invalid URL")

    // Retrieve (optional) roleID
    let roleId = ""
    if (message.mentions.roles.size > 0)
        roleId = message.mentions.roles.first().id

    // Retrieve and validate against existing feeds for this channel
    const feeds = message.guild.feeds.filter(x => x.channelId === channelId)
    if (feeds.find(x => x.url === url))
        throw new CommandRejection("Feed already exists")

    // Retrieve (optional) content display option (abbr v.s. full)
    let contentDisplayOption = "Default"
    if (params.length > 2 && params[3] === "abbr")
        contentDisplayOption = "Abbreviated"

    // Add new feed
    const newFeed = Feed.create(ShortId.generate(), url, channelId, roleId, contentDisplayOption)

    let prompt = `Are you happy with this? (y/n)\n\`\`\`JSON\n${JSON.stringify(newFeed.toFriendlyObject(message.guild), null, "\t")}\`\`\``
    let userResponse: DisharmonyMessage, commandResponse = ""
    while (commandResponse === "")
    {
        // Request confirmation
        const question = new Question(client, message.channelId, prompt, message.member, true)
        userResponse = await question.send()

        if (userResponse.content === "y")
        {
            await message.reply("Please wait while I validate the RSS feed")

            if (await getRssFetcher().validateFeed(url))
            {
                message.guild.feeds.push(newFeed)
                commandResponse = "Your new feed has been saved!"
            }
            else
                commandResponse = "This RSS feed is invalid"
        }
        else if (userResponse.content === "n")
            commandResponse = "Your feed has not been saved"
        else
            prompt = "Please enter **y** or **n** for yes or no"
    }
    return commandResponse
}

export default new Command(
    /*syntax*/          "add-feed <url> <#channel> [@role] <display?=default|abbr>",
    /*description*/     "Add an RSS feed to a channel, with optional role tagging and two content display options (default or abbreviated)",
    /*permissionLevel*/ PermissionLevel.Admin,
    /*invoke*/          invoke,
)

function isValid(url: string): boolean
{
    return !!Url.parse(url).hostname
}