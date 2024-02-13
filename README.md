This is the the cricket data api from the third party using of fetch api.Also i created a 3 table firts one for matches for giving all the information of mathes.venue table for venue details and finally teams table for teams details.All the data store in postgresql database.
//to run this 
//first create the database in postgresql or pgmyadmin4
//replace the your_username with yours database user name
//replace your_password with your password
//run it on localhost:3000
//to get the details of matches use /matches by using localhost:3000/matches

/*if you are linux user and facing an issue to download the pgmyadmin4 follow same instruction using this link [https://www.commandprompt.com/education/how-to-install-pgadmin-on-ubuntu/](url)
*/
but please do not forgot to change you database password at last because it set by default in install time.
using "psql";
postgres=# "ALTER USER postgres PASSWORD 'your new password'";
//check that connect or not by
"psql -U postgres"
