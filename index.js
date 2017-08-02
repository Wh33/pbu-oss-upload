/**
 * @author Chenzhyc
 * @description oss文件上传中间件
 */

const modules = {
    // 1.运营后台的学校图片上传
    // 2.院校管理后台的学校图片上传
    IMAGE_SCHOOL: 'image-school',
    // 3.用户中心的个人头像图片上传
    AVATAR_USER: 'avatar-user',
    // 4.教师管理平台的课程图片上传
    IMAGE_COURSE: 'image-course',
    // 5.发布课程的版本说明附件上传
    FILE_COURSE: 'file-course',
    // 7.批量导入的解析上传
    MEMBERS_IMPORT: 'members-import',
    // 6. 课程组件的文档等附件，需鉴权
    FILE_COURSE_PRIVATE: 'file-course-private'
}

/**
 * 根据功能模块生成上传路径
 * @param  {[type]} moduleName [description]
 * @param  {[type]} basePath   [description]
 * @return {[type]}            [description]
 */
function pathOfModule(moduleName, basePath, userId) {
    switch(moduleName) {
        case 'IMAGE_SCHOOL':
        case 'IMAGE_COURSE':
        case 'FILE_COURSE':
        case 'MEMBERS_IMPORT':
        case 'FILE_COURSE_PRIVATE':
            return `${basePath}/${userId}/${modules[moduleName]}/${Date.now()}`;
            break;

        case 'AVATAR_USER':
            //头像不需要时间戳
            return `${basePath}/${userId}/${modules[moduleName]}`;
            break;
        default:
            return null;
            break;
    }
}

module.exports.getUploadParams = function(aliyunConfig) {
    const accessKeyId = aliyunConfig.accessKeyId;
    const accessKeySecret = aliyunConfig.accessKeySecret;
    const region = aliyunConfig.region;
    const bucketPublic = aliyunConfig.bucketPublic;
    const basePath = aliyunConfig.basePath;
    const domainOSSPublic = aliyunConfig.domainOSSPublic;
    const domainImagePublic = aliyunConfig.domainImagePublic;
    const bucketPrivate = aliyunConfig.bucketPrivate;
    //设置半小时过期
    const expireTime = 60 * 30;

    /**
     * 根据config 签名
     * @param  {[type]} config [description]
     * @return {[type]}        [description]
     */
    function responseByConfig(config, expireEnd, upload_dir) {
        const policy = JSON.stringify(config);
        const base64Policy = (new Buffer(policy)).toString('base64');
        const stringToSign = base64Policy;

        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha1', accessKeySecret);
        hmac.update(stringToSign);
        const signature = hmac.digest('base64');

        const response = {
            code: 200,
            msg: '',
            tokenParams: {
                OSSAccessKeyId: accessKeyId,
                policy: base64Policy,
                signature: signature,
                expire: expireEnd,
                dir: upload_dir,
                success_action_status: '200'
            }
        }

        return response;
    }

    return function(req, res, next) {

        if (req.method === 'GET') {
            return next();
        }

        if (req.path !== '/private.params.upload.get') {
            return next();
        }

        if (!req.body.userId) {
            res.json({
                code: -1,
                msg: '无上传权限'
            });
            return;
        }

        if (!req.body.moduleName
            || req.body.moduleName === 'undefined') {
                res.json({
                    code: -1,
                    msg: '上传模块名称无效'
                });
                return;
        }

        const now = new Date().getTime();
        let expireEnd = now + expireTime * 1000;
        expireEnd = Math.round(expireEnd / 1000);
        const tokenExpire = new Date(new Date().getTime() + expireTime * 1000);

        const upload_dir = pathOfModule(req.body.moduleName, basePath, req.body.userId);

        const condition = [
            ["content-length-range", 0, 1048576000],
            ["starts-with", "$key", upload_dir]
        ];
        //create post policy json
        const config = {
            expiration: tokenExpire,
            conditions: condition
        };

        res.json(responseByConfig(config, expireEnd, upload_dir));
    }
}
