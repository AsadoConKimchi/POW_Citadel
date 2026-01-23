import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { determineRoleStatus } from '@/lib/utils';
import { APP_CONFIG } from '@/constants';

const DISCORD_API_URL = APP_CONFIG.DISCORD_API_URL;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user ID' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get user's discord_id from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('discord_id')
      .eq('id', userId)
      .single();

    if (userError || !user?.discord_id) {
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Get guild member info using Bot Token
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!botToken || !guildId) {
      return NextResponse.json(
        { error: '서버 설정 오류' },
        { status: 500 }
      );
    }

    const memberResponse = await fetch(
      `${DISCORD_API_URL}/guilds/${guildId}/members/${user.discord_id}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    if (!memberResponse.ok) {
      const errorText = await memberResponse.text();
      console.error('Discord API error:', errorText);
      return NextResponse.json(
        { error: '디스코드 서버에서 멤버 정보를 찾을 수 없습니다. 서버에 가입되어 있는지 확인해주세요.' },
        { status: 404 }
      );
    }

    const memberData = await memberResponse.json();
    const roles = memberData.roles || [];

    // Determine role status
    const roleStatus = determineRoleStatus(roles);

    // Update user in Supabase
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        discord_roles: roles,
        role_status: roleStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json(
        { error: '역할 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      roleStatus,
    });
  } catch (error) {
    console.error('Sync role error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
