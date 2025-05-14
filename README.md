# Notion to Google Docs

A TypeScript script that transfers content from a Notion page to a Google Docs document.

## Features

- Fetches content from a Notion page using the Notion API
- Converts Notion blocks to Google Docs format
- Writes the content to a Google Docs document
- Supports various Notion block types:
  - Paragraphs
  - Headings (H1, H2, H3)
  - Bulleted lists
  - Numbered lists
  - To-do items
  - Quotes
  - Code blocks
  - Dividers

## Prerequisites

- Node.js (v16 or higher)
- pnpm
- A Notion API key
- Google API credentials with Google Docs API access

## Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/notion-to-google-docs.git
cd notion-to-google-docs
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a `.env` file based on the `.env.example` template:

```bash
cp .env.example .env
```

4. Fill in your API credentials in the `.env` file:

```
# Notion API credentials
NOTION_API_KEY=your_notion_api_key
NOTION_PAGE_ID=your_notion_page_id

# Google API credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=your_google_redirect_uri
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
GOOGLE_DOC_ID=your_google_doc_id
```

### Getting Notion API Credentials

1. Go to [Notion Developers](https://developers.notion.com/) and create a new integration
2. Copy the API key
3. Share the Notion page you want to access with your integration
4. Get the page ID from the URL (the part after the workspace name and before the query parameters)

### Getting Google API Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Docs API
4. Create OAuth 2.0 credentials (client ID and client secret)
5. Set up the OAuth consent screen
6. Use the OAuth 2.0 Playground to get a refresh token:
   - Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
   - Set up the OAuth 2.0 Playground to use your client ID and client secret
   - Select the Google Docs API scope: `https://www.googleapis.com/auth/documents`
   - Exchange the authorization code for tokens
   - Copy the refresh token

## Usage

Run the script:

```bash
pnpm start
```

This will:
1. Fetch the content from the specified Notion page
2. Convert the content to Google Docs format
3. Write the content to the specified Google Docs document

## Development

Build the TypeScript code:

```bash
pnpm build
```

Run the script in development mode:

```bash
pnpm dev
```

## License

MIT
