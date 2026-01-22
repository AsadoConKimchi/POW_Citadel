import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getDiscordAvatarUrl, determineRoleStatus } from '@/lib/utils';
import { APP_CONFIG } from '@/constants';

const DISCORD_API_URL = APP_CONFIG.DISCORD_API_URL;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(`${DISCORD_API_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${baseUrl}/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch(`${DISCORD_API_URL}/users/@me`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('User fetch failed:', await userResponse.text());
      return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
    }

    const discordUser = await userResponse.json();

    // Get guild member info (roles)
    const guildId = process.env.DISCORD_GUILD_ID;
    const memberResponse = await fetch(
      `${DISCORD_API_URL}/users/@me/guilds/${guildId}/member`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let roles: string[] = [];
    if (memberResponse.ok) {
      const memberData = await memberResponse.json();
      roles = memberData.roles || [];
    }

    // Determine role status
    const roleStatus = determineRoleStatus(roles);

    // Get avatar URL
    const avatarUrl = getDiscordAvatarUrl(discordUser.id, discordUser.avatar);

    // Save/update user in Supabase
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Key starts with:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20));
    const supabase = createServiceRoleClient();

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', discordUser.id)
      .single();

    let user;

    if (existingUser) {
      // Update existing user
      const { data, error: updateError } = await supabase
        .from('users')
        .update({
          discord_username: discordUser.username,
          discord_avatar_url: avatarUrl,
          discord_roles: roles,
          role_status: roleStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('discord_id', discordUser.id)
        .select()
        .single();

      if (updateError) throw updateError;
      user = data;
    } else {
      // Create new user
      const { data, error: insertError } = await supabase
        .from('users')
        .insert({
          discord_id: discordUser.id,
          discord_username: discordUser.username,
          discord_avatar_url: avatarUrl,
          discord_roles: roles,
          role_status: roleStatus,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      user = data;
    }

    // Create session data
    const sessionData = {
      user,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    // Redirect with session data in URL (will be picked up by client)
    const redirectUrl = new URL(`${baseUrl}/my-pow`);
    redirectUrl.searchParams.set('session', Buffer.from(JSON.stringify(sessionData)).toString('base64'));

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
  }
}
