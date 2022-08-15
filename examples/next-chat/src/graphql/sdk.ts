import { GraphQLClient } from 'graphql-request';
import * as Dom from 'graphql-request/dist/types.dom';
export type Maybe<T> = T;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  timestamptz: string;
};

export type Int_Comparison_Exp = {
  _eq?: Maybe<Scalars['Int']>;
  _gt?: Maybe<Scalars['Int']>;
  _gte?: Maybe<Scalars['Int']>;
  _in?: Maybe<Array<Scalars['Int']>>;
  _is_null?: Maybe<Scalars['Boolean']>;
  _lt?: Maybe<Scalars['Int']>;
  _lte?: Maybe<Scalars['Int']>;
  _neq?: Maybe<Scalars['Int']>;
  _nin?: Maybe<Array<Scalars['Int']>>;
};

export type String_Comparison_Exp = {
  _eq?: Maybe<Scalars['String']>;
  _gt?: Maybe<Scalars['String']>;
  _gte?: Maybe<Scalars['String']>;
  _ilike?: Maybe<Scalars['String']>;
  _in?: Maybe<Array<Scalars['String']>>;
  _is_null?: Maybe<Scalars['Boolean']>;
  _like?: Maybe<Scalars['String']>;
  _lt?: Maybe<Scalars['String']>;
  _lte?: Maybe<Scalars['String']>;
  _neq?: Maybe<Scalars['String']>;
  _nilike?: Maybe<Scalars['String']>;
  _nin?: Maybe<Array<Scalars['String']>>;
  _nlike?: Maybe<Scalars['String']>;
  _nsimilar?: Maybe<Scalars['String']>;
  _similar?: Maybe<Scalars['String']>;
};




export type Messages_Aggregate_Order_By = {
  avg?: Maybe<Messages_Avg_Order_By>;
  count?: Maybe<Order_By>;
  max?: Maybe<Messages_Max_Order_By>;
  min?: Maybe<Messages_Min_Order_By>;
  stddev?: Maybe<Messages_Stddev_Order_By>;
  stddev_pop?: Maybe<Messages_Stddev_Pop_Order_By>;
  stddev_samp?: Maybe<Messages_Stddev_Samp_Order_By>;
  sum?: Maybe<Messages_Sum_Order_By>;
  var_pop?: Maybe<Messages_Var_Pop_Order_By>;
  var_samp?: Maybe<Messages_Var_Samp_Order_By>;
  variance?: Maybe<Messages_Variance_Order_By>;
};

export type Messages_Arr_Rel_Insert_Input = {
  data: Array<Messages_Insert_Input>;
  on_conflict?: Maybe<Messages_On_Conflict>;
};


export type Messages_Avg_Order_By = {
  id?: Maybe<Order_By>;
};

export type Messages_Bool_Exp = {
  _and?: Maybe<Array<Maybe<Messages_Bool_Exp>>>;
  _not?: Maybe<Messages_Bool_Exp>;
  _or?: Maybe<Array<Maybe<Messages_Bool_Exp>>>;
  author?: Maybe<String_Comparison_Exp>;
  date?: Maybe<Timestamptz_Comparison_Exp>;
  id?: Maybe<Int_Comparison_Exp>;
  text?: Maybe<String_Comparison_Exp>;
  user?: Maybe<Users_Bool_Exp>;
};

export type Messages_Constraint =
  | 'messages_pkey';

export type Messages_Inc_Input = {
  id?: Maybe<Scalars['Int']>;
};

export type Messages_Insert_Input = {
  author?: Maybe<Scalars['String']>;
  date?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['Int']>;
  text?: Maybe<Scalars['String']>;
  user?: Maybe<Users_Obj_Rel_Insert_Input>;
};


export type Messages_Max_Order_By = {
  author?: Maybe<Order_By>;
  date?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  text?: Maybe<Order_By>;
};


export type Messages_Min_Order_By = {
  author?: Maybe<Order_By>;
  date?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  text?: Maybe<Order_By>;
};


export type Messages_Obj_Rel_Insert_Input = {
  data: Messages_Insert_Input;
  on_conflict?: Maybe<Messages_On_Conflict>;
};

export type Messages_On_Conflict = {
  constraint: Messages_Constraint;
  update_columns: Array<Messages_Update_Column>;
  where?: Maybe<Messages_Bool_Exp>;
};

export type Messages_Order_By = {
  author?: Maybe<Order_By>;
  date?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  text?: Maybe<Order_By>;
  user?: Maybe<Users_Order_By>;
};

export type Messages_Pk_Columns_Input = {
  id: Scalars['Int'];
};

export type Messages_Select_Column =
  | 'author'
  | 'date'
  | 'id'
  | 'text';

export type Messages_Set_Input = {
  author?: Maybe<Scalars['String']>;
  date?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['Int']>;
  text?: Maybe<Scalars['String']>;
};


export type Messages_Stddev_Order_By = {
  id?: Maybe<Order_By>;
};


export type Messages_Stddev_Pop_Order_By = {
  id?: Maybe<Order_By>;
};


export type Messages_Stddev_Samp_Order_By = {
  id?: Maybe<Order_By>;
};


export type Messages_Sum_Order_By = {
  id?: Maybe<Order_By>;
};

export type Messages_Update_Column =
  | 'author'
  | 'date'
  | 'id'
  | 'text';


export type Messages_Var_Pop_Order_By = {
  id?: Maybe<Order_By>;
};


export type Messages_Var_Samp_Order_By = {
  id?: Maybe<Order_By>;
};


export type Messages_Variance_Order_By = {
  id?: Maybe<Order_By>;
};


export type Order_By =
  | 'asc'
  | 'asc_nulls_first'
  | 'asc_nulls_last'
  | 'desc'
  | 'desc_nulls_first'
  | 'desc_nulls_last';




export type Timestamptz_Comparison_Exp = {
  _eq?: Maybe<Scalars['timestamptz']>;
  _gt?: Maybe<Scalars['timestamptz']>;
  _gte?: Maybe<Scalars['timestamptz']>;
  _in?: Maybe<Array<Scalars['timestamptz']>>;
  _is_null?: Maybe<Scalars['Boolean']>;
  _lt?: Maybe<Scalars['timestamptz']>;
  _lte?: Maybe<Scalars['timestamptz']>;
  _neq?: Maybe<Scalars['timestamptz']>;
  _nin?: Maybe<Array<Scalars['timestamptz']>>;
};




export type Users_Aggregate_Order_By = {
  count?: Maybe<Order_By>;
  max?: Maybe<Users_Max_Order_By>;
  min?: Maybe<Users_Min_Order_By>;
};

export type Users_Arr_Rel_Insert_Input = {
  data: Array<Users_Insert_Input>;
  on_conflict?: Maybe<Users_On_Conflict>;
};

export type Users_Bool_Exp = {
  _and?: Maybe<Array<Maybe<Users_Bool_Exp>>>;
  _not?: Maybe<Users_Bool_Exp>;
  _or?: Maybe<Array<Maybe<Users_Bool_Exp>>>;
  messages?: Maybe<Messages_Bool_Exp>;
  name?: Maybe<String_Comparison_Exp>;
  password?: Maybe<String_Comparison_Exp>;
  session?: Maybe<String_Comparison_Exp>;
};

export type Users_Constraint =
  | 'users_pkey';

export type Users_Insert_Input = {
  messages?: Maybe<Messages_Arr_Rel_Insert_Input>;
  name?: Maybe<Scalars['String']>;
  password?: Maybe<Scalars['String']>;
  session?: Maybe<Scalars['String']>;
};


export type Users_Max_Order_By = {
  name?: Maybe<Order_By>;
  password?: Maybe<Order_By>;
  session?: Maybe<Order_By>;
};


export type Users_Min_Order_By = {
  name?: Maybe<Order_By>;
  password?: Maybe<Order_By>;
  session?: Maybe<Order_By>;
};


export type Users_Obj_Rel_Insert_Input = {
  data: Users_Insert_Input;
  on_conflict?: Maybe<Users_On_Conflict>;
};

export type Users_On_Conflict = {
  constraint: Users_Constraint;
  update_columns: Array<Users_Update_Column>;
  where?: Maybe<Users_Bool_Exp>;
};

export type Users_Order_By = {
  messages_aggregate?: Maybe<Messages_Aggregate_Order_By>;
  name?: Maybe<Order_By>;
  password?: Maybe<Order_By>;
  session?: Maybe<Order_By>;
};

export type Users_Pk_Columns_Input = {
  name: Scalars['String'];
};

export type Users_Select_Column =
  | 'name'
  | 'password'
  | 'session';

export type Users_Set_Input = {
  name?: Maybe<Scalars['String']>;
  password?: Maybe<Scalars['String']>;
  session?: Maybe<Scalars['String']>;
};

export type Users_Update_Column =
  | 'name'
  | 'password'
  | 'session';

export type CreateMessageMutationVariables = Exact<{
  author: Scalars['String'];
  text: Scalars['String'];
}>;


export type CreateMessageMutation = { insert_messages_one?: Maybe<{ id: number }> };

export type CreateUserMutationVariables = Exact<{
  name: Scalars['String'];
  password: Scalars['String'];
  session: Scalars['String'];
}>;


export type CreateUserMutation = { insert_users_one?: Maybe<{ session?: Maybe<string> }> };

export type GetMessagesQueryVariables = Exact<{
  session: Scalars['String'];
}>;


export type GetMessagesQuery = { messages: Array<{ id: number, date: string, author: string, text: string }>, users: Array<{ name: string }> };

export type GetNewMessagesQueryVariables = Exact<{
  session: Scalars['String'];
  from: Scalars['Int'];
}>;


export type GetNewMessagesQuery = { messages: Array<{ id: number, date: string, author: string, text: string }>, users: Array<{ name: string }> };

export type GetUserQueryVariables = Exact<{
  session: Scalars['String'];
}>;


export type GetUserQuery = { users: Array<{ name: string }> };

export type GetUserSessionQueryVariables = Exact<{
  name: Scalars['String'];
}>;


export type GetUserSessionQuery = { users: Array<{ session?: Maybe<string>, password: string }> };


export const CreateMessageDocument = `
    mutation createMessage($author: String!, $text: String!) {
  insert_messages_one(object: {author: $author, text: $text}) {
    id
  }
}
    `;
export const CreateUserDocument = `
    mutation createUser($name: String!, $password: String!, $session: String!) {
  insert_users_one(object: {name: $name, password: $password, session: $session}) {
    session
  }
}
    `;
export const GetMessagesDocument = `
    query getMessages($session: String!) {
  messages(limit: 50) {
    id
    date
    author
    text
  }
  users(where: {session: {_eq: $session}}) {
    name
  }
}
    `;
export const GetNewMessagesDocument = `
    query getNewMessages($session: String!, $from: Int!) {
  messages(where: {id: {_gt: $from}}) {
    id
    date
    author
    text
  }
  users(where: {session: {_eq: $session}}) {
    name
  }
}
    `;
export const GetUserDocument = `
    query getUser($session: String!) {
  users(where: {session: {_eq: $session}}) {
    name
  }
}
    `;
export const GetUserSessionDocument = `
    query getUserSession($name: String!) {
  users(where: {name: {_eq: $name}}) {
    session
    password
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: () => Promise<T>) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = sdkFunction => sdkFunction();
export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    createMessage(variables: CreateMessageMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<CreateMessageMutation> {
      return withWrapper(() => client.request<CreateMessageMutation>(CreateMessageDocument, variables, requestHeaders));
    },
    createUser(variables: CreateUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<CreateUserMutation> {
      return withWrapper(() => client.request<CreateUserMutation>(CreateUserDocument, variables, requestHeaders));
    },
    getMessages(variables: GetMessagesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetMessagesQuery> {
      return withWrapper(() => client.request<GetMessagesQuery>(GetMessagesDocument, variables, requestHeaders));
    },
    getNewMessages(variables: GetNewMessagesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetNewMessagesQuery> {
      return withWrapper(() => client.request<GetNewMessagesQuery>(GetNewMessagesDocument, variables, requestHeaders));
    },
    getUser(variables: GetUserQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetUserQuery> {
      return withWrapper(() => client.request<GetUserQuery>(GetUserDocument, variables, requestHeaders));
    },
    getUserSession(variables: GetUserSessionQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetUserSessionQuery> {
      return withWrapper(() => client.request<GetUserSessionQuery>(GetUserSessionDocument, variables, requestHeaders));
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;