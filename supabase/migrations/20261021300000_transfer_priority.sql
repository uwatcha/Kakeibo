-- 足りなくなる口座への振替の提案で、振替元にするかと、使う順番（改善要望より）
-- 0 = 振替に使わない、1 = 低、2 = 普通、3 = 高（高いほど先に使う）
alter table accounts add column transfer_priority smallint not null default 2
  check (transfer_priority between 0 and 3);

-- これまでの扱いに合わせる: 投資・クレカ・貸し借りの相手は使わない、普段使わない口座は後回し
update accounts set transfer_priority = 0 where kind in ('investment', 'credit_card', 'receivable', 'payable');
update accounts set transfer_priority = 1 where is_reserved and kind in ('cash', 'bank', 'emoney');
-- サンプル銀行Bよりサンプル銀行を先に使う（ユーザーの要望）
update accounts set transfer_priority = 3 where name = 'サンプル銀行';
