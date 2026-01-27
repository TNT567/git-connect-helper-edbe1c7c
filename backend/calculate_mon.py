# 子钱包的wei余额
wei_balance =  int(input("please input mon number"))
# MON与wei的换算比例
mon_per_wei = 10**18
# 换算成MON
mon_balance = wei_balance / mon_per_wei

print(f"该子钱包的MON余额：{mon_balance} MON")
# 输出：该子钱包的MON余额：0.3235 MON
