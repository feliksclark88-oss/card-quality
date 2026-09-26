"""Browser smoke for the local demo. Start python3 -m http.server 8791 first.
Requires the separately installed agent-browser CLI.
"""
import subprocess,json
session='card-quality-smoke'
def ab(*args):
 r=subprocess.run(['agent-browser','--session',session,*args],capture_output=True,text=True)
 assert r.returncode==0, (args,r.stderr)
 return r.stdout.strip()
def read(expr):
 return json.loads(ab('eval',expr))
ab('set','viewport','1280','900')
ab('open','http://127.0.0.1:8791/demo/')
ab('wait','.cardcheck-tehprof__check')
checks=[]
for scenario,expected,cost in [('attention','С подсказками: 5',1),('clean','С подсказками: 0',1),('international','Международные адреса допустимы',1),('empty','нет сохранённых',1),('company','С подсказками: 0',1),('new','Сначала сохраните',0),('unauthorized','Сессия amoCRM недоступна',1),('forbidden','Недостаточно прав',1),('deleted','Сохранённая карточка недоступна',1),('failure','Не удалось загрузить',1),('malformed','Не удалось прочитать ожидаемый формат',1),('different','Не удалось прочитать ожидаемый формат',1),('xss','<img src=x onerror=alert(1)>',1)]:
 ab('select','#scenario',scenario)
 before=read('window.demoRequests.length')
 ab('scrollintoview','.cardcheck-tehprof__check')
 ab('click','.cardcheck-tehprof__check')
 ab('wait','--fn',"!document.querySelector('.cardcheck-tehprof__check').disabled")
 text=read("document.querySelector('.cardcheck-tehprof').innerText")
 assert expected in text,(scenario,expected)
 after=read('window.demoRequests.length')
 assert after-before==cost,(scenario,after-before)
 assert read("document.querySelector('.cardcheck-tehprof').querySelectorAll('img,script,iframe').length")==0
 checks.append({'scenario':scenario,'passed':True,'requests':cost})
# Destroy while a response is pending; recreated widget must stay clean.
ab('select','#scenario','clean');ab('click','.cardcheck-tehprof__check');ab('click','#destroy')
assert read("document.querySelectorAll('.cardcheck-tehprof').length")==0
ab('click','#mount')
ab('wait','--text','Проверка начнётся по нажатию кнопки.')
assert read("document.querySelectorAll('.cardcheck-tehprof').length")==1
assert read("document.querySelectorAll('.cardcheck-tehprof__result').length")==0
checks.append({'scenario':'destroy-and-recreate','passed':True})
ab('close')
print('PASS browser '+str(len(checks))+' scenarios: cost, statuses, literal HTML, destroy/recreate')
