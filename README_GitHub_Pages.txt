宇宙混戰狼人殺 V6｜GitHub Pages 上線包
========================================

檔案結構
- index.html：網站入口（必須放在 Repository 根目錄）
- style.css：介面樣式
- script.js：遊戲程式
- .nojekyll：避免 GitHub Pages 跳過特殊檔案

上傳到 GitHub Pages
1. 登入 https://github.com/
2. 按右上角 + → New repository。
3. Repository name 可填：werewolf-v6
4. 選 Public，按 Create repository。
5. 在新 Repository 頁面按 Add file → Upload files。
6. 將本資料夾內的 index.html、style.css、script.js、.nojekyll 全部拖曳上傳。
   注意：要上傳檔案本身，不要把整個資料夾再包一層；index.html 必須位於 Repository 根目錄。
7. 按 Commit changes。
8. 開啟 Settings → Pages。
9. 在 Build and deployment 下，Source 選 Deploy from a branch。
10. Branch 選 main，資料夾選 /(root)，按 Save。
11. 等待 GitHub Pages 部署完成，頁面會顯示網址，通常格式為：
    https://你的GitHub帳號.github.io/werewolf-v6/

更新遊戲
- 修改本機檔案後，回到 Repository → Add file → Upload files，上傳新版檔案並 Commit。
- 若瀏覽器仍顯示舊版，按 Ctrl + F5 強制重新整理。

重要提醒
- GitHub Pages 只負責公開靜態網頁，不會自動補上遊戲後端。
- 目前版本仍是開發原型；多人連線同步及部分職業技能尚未完整，請先用少量玩家測試。
- PeerJS 使用外部訊號服務，能否連線仍受網路、瀏覽器及服務可用性影響。
- 「AI 主持語音」使用瀏覽器內建語音合成；補位玩家目前是簡化隨機行動，不是真正的語言模型 AI。
- 建議使用最新版 Chrome 或 Edge。首次使用語音時，先點擊網頁中的按鈕以允許瀏覽器啟動語音。
