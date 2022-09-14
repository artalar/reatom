import { GetMessagesQuery } from "~/graphql/sdk";

export type Message = GetMessagesQuery['messages'][number]