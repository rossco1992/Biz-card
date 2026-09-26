-- Read-only checks. A successful cron run only means HTTP was queued.
select jobid, jobname, schedule, active from cron.job
where jobname = 'knctd-send-followups';

select d.start_time, d.end_time, d.status, d.return_message
from cron.job_run_details d join cron.job j using (jobid)
where j.jobname = 'knctd-send-followups'
order by d.start_time desc limit 10;

-- Confirm HTTP 200 and inspect processed/sent/failed counts as well.
-- pg_net responses have limited retention; null may mean pending or expired.
select q.requested_at, q.request_id, r.status_code, r.timed_out,
       r.error_msg, r.content
from knctd_scheduler.requests q
left join net._http_response r on r.id = q.request_id
order by q.requested_at desc limit 10;
