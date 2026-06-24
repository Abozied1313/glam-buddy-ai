# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/5e89785d-9380-4e24-b08c-450110974b42

## Agent Center

This branch adds a read-only Agent Center page at:

```text
/agent
```

The page is designed to open safely inside Glam Buddy without calling Ollama or any `localhost` endpoint directly. Glam Buddy's production AI path remains the existing Supabase-based flow:

- Supabase Auth keeps user sign-in separate from the agent page.
- The `analyze-style` Edge Function handles style analysis.
- Gemini/Lovable is used for analysis inside the backend flow.
- Replicate is used for image generation from the backend only.

The Agent Center is intentionally safe:

- It does not execute commands.
- It does not install, delete, move, commit, push, pull, or kill processes.
- It does not expose Replicate secrets in the frontend.
- It does not change Google OAuth behavior.
- It is meant to organize prompts, explain workstation reports, and plan manual next steps.

To use it locally:

```sh
npm i
npm run dev
```

Then open `/agent` inside the app. Optional local Qwen or Qwen Coder support should be added later through a separate local bridge service after explicit approval, not by calling Ollama directly from the browser.

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/5e89785d-9380-4e24-b08c-450110974b42) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/5e89785d-9380-4e24-b08c-450110974b42) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
