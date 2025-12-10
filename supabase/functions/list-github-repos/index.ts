import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Get user info
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching GitHub repos for user: ${user.id}`);

    // Find GitHub identity and get provider token
    const githubIdentity = user.identities?.find(
      identity => identity.provider === 'github'
    );

    if (!githubIdentity) {
      console.log('No GitHub identity found for user');
      return new Response(
        JSON.stringify({ error: 'Conta GitHub não conectada. Por favor, conecte sua conta GitHub primeiro.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the session to access provider token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('Error getting session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Sessão não encontrada' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // The provider_token should be in the session
    const providerToken = session.provider_token;
    
    if (!providerToken) {
      console.log('No provider token found in session');
      return new Response(
        JSON.stringify({ 
          error: 'Token do GitHub não disponível. Por favor, reconecte sua conta GitHub.',
          reconnect_required: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch repos from GitHub API
    console.log('Fetching repos from GitHub API...');
    
    const githubResponse = await fetch(
      'https://api.github.com/user/repos?sort=updated&direction=desc&per_page=100&type=all',
      {
        headers: {
          'Authorization': `Bearer ${providerToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitAnalyzer-App'
        }
      }
    );

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error('GitHub API error:', githubResponse.status, errorText);
      
      if (githubResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: 'Token do GitHub expirado. Por favor, reconecte sua conta.',
            reconnect_required: true 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Erro ao buscar repositórios: ${githubResponse.statusText}` }),
        { status: githubResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const repos: GitHubRepo[] = await githubResponse.json();
    
    console.log(`Successfully fetched ${repos.length} repos`);

    // Map to simpler format
    const simplifiedRepos = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      private: repo.private,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      language: repo.language,
      updated_at: repo.updated_at
    }));

    return new Response(
      JSON.stringify({ repos: simplifiedRepos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
