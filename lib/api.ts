export type InstanceData = {
  instanceId: string
  runtimeId: string
  startTime: string
  nonce: number
}
export type AuthorizationData = {
  instanceId: string
  scriptPayload: string
  blockhash: string
  blockheight: string
}
/** */
export type PostMeta = {
  hasWalletUpvoted: boolean
  hasWalletDownvoted: boolean
  txidsUpvoted: string[]
  txidsDownvoted: string[]
}
/** Comment data returned from RANK backend API */
export type RankCommentAPI = {
  txid: string
  outIdx: number
  sats: string
  firstSeen: string
  scriptPayload: string
  instanceId: string
  height: number
  data: string
  feeRate: number
  platform: string
  inReplyToProfileId?: string
  inReplyToPostId?: string
  repliedProfile?: IndexedProfileRanking
  repliedPost?: IndexedPostRanking
}
/** */
export type RankAPIParams = {
  platform: string
  profileId: string
}
/** Profile ranking returned from RANK backend API */
export type IndexedProfileRanking = RankAPIParams & {
  ranking: string
  satsPositive: string
  satsNegative: string
  votesPositive: number
  votesNegative: number
  /** Comments associated with the profile */
  comments?: RankCommentAPI[]
  /** Posts associated with the profile */
  posts?: IndexedPostRanking[]
}
/** Post ranking returned from RANK backend API */
export type IndexedPostRanking = RankAPIParams & {
  ranking: string
  satsPositive: string
  satsNegative: string
  votesPositive: number
  votesNegative: number
  profile: IndexedProfileRanking
  postId: string
  /** Comments associated with the post */
  comments?: RankCommentAPI[]
  /** Comment data as a UTF-8 string, if available */
  data?: string
  postMeta?: PostMeta
}

/** Authentication header parameters provided to client for authorization to API */
export const AuthenticateHeader = {
  scheme: 'BlockDataSig',
  param: ['blockhash', 'blockheight'],
}
