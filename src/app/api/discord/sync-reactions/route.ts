import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const DISCORD_API_URL = 'https://discord.com/api/v10';
const SYNC_COOLDOWN_MS = 60 * 1000; // 1분 쿨다운

// Sync Discord reactions for all POW records
export async function POST() {
  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_POW_CHANNEL_ID;

    if (!botToken || !channelId) {
      return NextResponse.json(
        { error: 'Discord configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createServiceRoleClient();

    // 서버 사이드 쿨다운 체크
    const { data: syncLog } = await supabase
      .from('sync_logs')
      .select('last_synced_at, sync_count')
      .eq('type', 'discord_reactions')
      .single();

    const lastSynced = syncLog?.last_synced_at
      ? new Date(syncLog.last_synced_at).getTime()
      : 0;
    const now = Date.now();

    if (now - lastSynced < SYNC_COOLDOWN_MS) {
      const nextSyncAvailable = new Date(lastSynced + SYNC_COOLDOWN_MS);
      return NextResponse.json({
        message: 'Skipped - recently synced',
        skipped: true,
        nextSyncAvailable: nextSyncAvailable.toISOString(),
        remainingSeconds: Math.ceil((lastSynced + SYNC_COOLDOWN_MS - now) / 1000),
      });
    }

    // Get all POW records with discord_message_id
    const { data: powRecords, error: fetchError } = await supabase
      .from('pow_records')
      .select('id, discord_message_id')
      .not('discord_message_id', 'is', null);

    if (fetchError) {
      console.error('Failed to fetch POW records:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch POW records' },
        { status: 500 }
      );
    }

    if (!powRecords || powRecords.length === 0) {
      return NextResponse.json({ message: 'No POW records to sync', updated: 0 });
    }

    let updatedCount = 0;

    for (const record of powRecords) {
      try {
        // Fetch message from Discord
        const messageResponse = await fetch(
          `${DISCORD_API_URL}/channels/${channelId}/messages/${record.discord_message_id}`,
          {
            headers: {
              'Authorization': `Bot ${botToken}`,
            },
          }
        );

        if (!messageResponse.ok) {
          console.error(`Failed to fetch message ${record.discord_message_id}:`, messageResponse.status);
          console.error('Rate Limit Headers:', {
            limit: messageResponse.headers.get('X-RateLimit-Limit'),
            remaining: messageResponse.headers.get('X-RateLimit-Remaining'),
            resetAfter: messageResponse.headers.get('X-RateLimit-Reset-After'),
            retryAfter: messageResponse.headers.get('Retry-After'),
            scope: messageResponse.headers.get('X-RateLimit-Scope'),
          });
          continue;
        }

        const messageData = await messageResponse.json();
        const reactions = messageData.reactions || [];

        // Calculate total reactions and build details
        let totalReactions = 0;
        const reactionDetails: Record<string, number> = {};

        for (const reaction of reactions) {
          const emoji = reaction.emoji.name;
          const count = reaction.count || 0;
          totalReactions += count;
          reactionDetails[emoji] = count;
        }

        // Check if record exists
        const { data: existingReaction } = await supabase
          .from('discord_reactions')
          .select('id')
          .eq('pow_record_id', record.id)
          .single();

        if (existingReaction) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('discord_reactions')
            .update({
              total_reactions: totalReactions,
              reaction_details: reactionDetails,
              last_updated_at: new Date().toISOString(),
            })
            .eq('pow_record_id', record.id);

          if (updateError) {
            console.error(`Failed to update reactions for ${record.id}:`, updateError);
            continue;
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('discord_reactions')
            .insert({
              pow_record_id: record.id,
              discord_message_id: record.discord_message_id,
              total_reactions: totalReactions,
              reaction_details: reactionDetails,
            });

          if (insertError) {
            console.error(`Failed to insert reactions for ${record.id}:`, insertError);
            continue;
          }
        }

        updatedCount++;
      } catch (err) {
        console.error(`Error processing record ${record.id}:`, err);
      }
    }

    // 동기화 시간 기록
    await supabase
      .from('sync_logs')
      .upsert({
        type: 'discord_reactions',
        last_synced_at: new Date().toISOString(),
        sync_count: (syncLog as any)?.sync_count ? (syncLog as any).sync_count + 1 : 1,
      }, {
        onConflict: 'type',
      });

    return NextResponse.json({
      message: 'Reactions synced successfully',
      updated: updatedCount,
      total: powRecords.length,
      skipped: false,
    });
  } catch (error) {
    console.error('Sync reactions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to sync reactions for a specific POW record
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const powRecordId = searchParams.get('powRecordId');

  if (!powRecordId) {
    return NextResponse.json(
      { error: 'powRecordId is required' },
      { status: 400 }
    );
  }

  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_POW_CHANNEL_ID;

    if (!botToken || !channelId) {
      return NextResponse.json(
        { error: 'Discord configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get POW record
    const { data: powRecord, error: fetchError } = await supabase
      .from('pow_records')
      .select('id, discord_message_id')
      .eq('id', powRecordId)
      .single();

    if (fetchError || !powRecord) {
      return NextResponse.json(
        { error: 'POW record not found' },
        { status: 404 }
      );
    }

    if (!powRecord.discord_message_id) {
      return NextResponse.json(
        { error: 'POW record has no Discord message' },
        { status: 400 }
      );
    }

    // Fetch message from Discord
    const messageResponse = await fetch(
      `${DISCORD_API_URL}/channels/${channelId}/messages/${powRecord.discord_message_id}`,
      {
        headers: {
          'Authorization': `Bot ${botToken}`,
        },
      }
    );

    if (!messageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch Discord message' },
        { status: 500 }
      );
    }

    const messageData = await messageResponse.json();
    const reactions = messageData.reactions || [];

    // Calculate total reactions and build details
    let totalReactions = 0;
    const reactionDetails: Record<string, number> = {};

    for (const reaction of reactions) {
      const emoji = reaction.emoji.name;
      const count = reaction.count || 0;
      totalReactions += count;
      reactionDetails[emoji] = count;
    }

    // Check if record exists
    const { data: existingReaction } = await supabase
      .from('discord_reactions')
      .select('id')
      .eq('pow_record_id', powRecord.id)
      .single();

    if (existingReaction) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('discord_reactions')
        .update({
          total_reactions: totalReactions,
          reaction_details: reactionDetails,
          last_updated_at: new Date().toISOString(),
        })
        .eq('pow_record_id', powRecord.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update reactions' },
          { status: 500 }
        );
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('discord_reactions')
        .insert({
          pow_record_id: powRecord.id,
          discord_message_id: powRecord.discord_message_id,
          total_reactions: totalReactions,
          reaction_details: reactionDetails,
        });

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to insert reactions' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      message: 'Reactions synced successfully',
      totalReactions,
      reactionDetails,
    });
  } catch (error) {
    console.error('Sync single reaction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
